import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockedDb = { name: 'sales-ops-route-test-db' };
const serviceMocks = vi.hoisted(() => ({
  createPerson: vi.fn(),
  listPeople: vi.fn(),
  updatePerson: vi.fn(),
}));

vi.mock('../../../db/client.js', () => ({
  getDb: () => mockedDb,
}));

vi.mock('../service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../service.js')>();
  return {
    ...actual,
    createPerson: serviceMocks.createPerson,
    listPeople: serviceMocks.listPeople,
    updatePerson: serviceMocks.updatePerson,
  };
});

const { salesOpsRouter } = await import('../routes.js');

type TestRole = 'admin' | 'seller' | 'finder' | undefined;

const personPayload = {
  displayName: 'Alex Silva',
  contactEmail: 'alex.silva@fxl.example',
  status: 'active' as const,
  isSeller: true,
  isFinder: false,
  isCollaborator: false,
  orgId: 'body-org-must-not-be-used',
  workspaceId: 'body-workspace-must-not-be-used',
};

const personResult = {
  id: '11111111-1111-4111-8111-111111111111',
  orgId: 'verified-org',
  displayName: personPayload.displayName,
  contactEmail: personPayload.contactEmail,
  status: personPayload.status,
  isSeller: personPayload.isSeller,
  isFinder: personPayload.isFinder,
  isCollaborator: personPayload.isCollaborator,
};

let currentRole: TestRole;

function createTestApp() {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('userId', 'verified-account');
    c.set('orgId', 'verified-org');
    c.set('userRole', currentRole);
    c.set('userRoles', currentRole ? [currentRole] : []);
    await next();
  });
  app.route('/', salesOpsRouter);
  return app;
}

const app = createTestApp();

function jsonRequest(method: 'POST' | 'PATCH', path: string) {
  return app.request(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(personPayload),
  });
}

beforeEach(() => {
  currentRole = undefined;
  vi.clearAllMocks();
  serviceMocks.listPeople.mockResolvedValue([personResult]);
  serviceMocks.createPerson.mockResolvedValue(personResult);
  serviceMocks.updatePerson.mockResolvedValue(personResult);
});

describe('Sales Ops people routes', () => {
  it.each(['seller', 'finder'] as const)('keeps GET /people available to %s', async (role) => {
    currentRole = role;

    const response = await app.request('/people');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ people: [personResult] });
    expect(serviceMocks.listPeople).toHaveBeenCalledWith(mockedDb, 'verified-org');
  });

  it.each(['seller', 'finder', undefined] as const)(
    'rejects POST /people for role %s before service execution',
    async (role) => {
      currentRole = role;

      const response = await jsonRequest('POST', '/people');

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        error: 'forbidden',
        reason: 'admin_role_required',
      });
      expect(serviceMocks.createPerson).not.toHaveBeenCalled();
    },
  );

  it.each(['seller', 'finder', undefined] as const)(
    'rejects PATCH /people/:id for role %s before service execution',
    async (role) => {
      currentRole = role;

      const response = await jsonRequest(
        'PATCH',
        '/people/11111111-1111-4111-8111-111111111111',
      );

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        error: 'forbidden',
        reason: 'admin_role_required',
      });
      expect(serviceMocks.updatePerson).not.toHaveBeenCalled();
    },
  );

  it('allows an admin to create a person with the verified org context', async () => {
    currentRole = 'admin';

    const response = await jsonRequest('POST', '/people');

    expect(response.status).toBe(201);
    expect(serviceMocks.createPerson).toHaveBeenCalledWith(
      mockedDb,
      'verified-org',
      expect.not.objectContaining({ orgId: expect.anything(), workspaceId: expect.anything() }),
    );
  });

  it('allows an admin to update a person with the verified org context', async () => {
    currentRole = 'admin';

    const response = await jsonRequest(
      'PATCH',
      '/people/11111111-1111-4111-8111-111111111111',
    );

    expect(response.status).toBe(200);
    expect(serviceMocks.updatePerson).toHaveBeenCalledWith(
      mockedDb,
      'verified-org',
      '11111111-1111-4111-8111-111111111111',
      expect.not.objectContaining({ orgId: expect.anything(), workspaceId: expect.anything() }),
    );
  });
});
