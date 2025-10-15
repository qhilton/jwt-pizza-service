const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');

async function createAdminUser() {
  let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + '@admin.com';

  user = await DB.addUser(user);
  return { ...user, password: 'toomanysecrets' };
}

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a', id: 4 };
let testUserAuthToken;
let adminAuthToken;

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);

  const adminUser = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send({
    name: adminUser.name,
    email: adminUser.email,
    password: adminUser.password
  });
  adminAuthToken = loginRes.body.token;
  expectValidJwt(adminAuthToken);
});

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}

test('list users unauthorized', async () => {
  const listUsersRes = await request(app).get('/api/user');
  expect(listUsersRes.status).toBe(401);
});

test('list users', async () => {
//   const [user, userToken] = await createAdminUser(request(app));
  await createAdminUser();

  const listUsersRes = await request(app)
    .get('/api/user')
    .set('Authorization', 'Bearer ' + adminAuthToken);
  expect(listUsersRes.status).toBe(200);
});

test('delete user unauthorized', async () => {
  const listUsersRes = await request(app).delete('/api/user'+ testUser.id);
  expect(listUsersRes.status).toBe(404);
});

test('delete user', async () => {
  const userToDelete = {
    name: 'User to Delete',
    email: randomName() + '@delete.com',
    password: 'deletepass'
  };
  
  const createRes = await request(app)
    .post('/api/auth')
    .send(userToDelete);
  
  expect(createRes.status).toBe(200);
  const userToDeleteId = createRes.body.user.id;

  // Delete the user as admin
  const deleteRes = await request(app)
    .delete(`/api/user/${userToDeleteId}`)
    .set('Authorization', `Bearer ${adminAuthToken}`);

  expect(deleteRes.status).toBe(200);
  expect(deleteRes.body).toMatchObject({ message: 'user deleted' });
});