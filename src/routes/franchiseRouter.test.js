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

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;
let adminAuthToken;
let adminName;
let adminEmail;

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
  adminName = adminUser.name;
  adminEmail = adminUser.email;
  expectValidJwt(adminAuthToken);
});

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}

test('getFranchises', async () => {
  const getFranchiseRes = await request(app).get('/api/franchise?page=0&limit=10&name=*');
  expect(getFranchiseRes.status).toBe(200);

//   expect(getFranchiseRes.body).toMatchObject({franchises: expect.arrayContaining([
//     expect.objectContaining({
//       id: 1,
//       name: 'pizzaPocket',
//       stores: expect.arrayContaining([
//         expect.objectContaining({
//           id: 1,
//           name: 'SLC',
//         })
//       ]),
//     })
//   ])});
});

test('getUserFranchises', async () => {
  const getUserFranchiseRes = await request(app).get('/api/franchise/:userId').set('Authorization', `Bearer ${adminAuthToken}`);
  expect(getUserFranchiseRes.status).toBe(200);
});

test('createFranchise', async () => {
  const newFranchise = {
    name: adminName,
    admins: [{ email: adminEmail }]
  };
  
  const badFranchiseRes = await request(app).post('/api/franchise').set('Authorization', `Bearer ${testUserAuthToken}`).send(newFranchise);
  expect(badFranchiseRes.status).toBe(403);

  const addFranchiseRes = await request(app).post('/api/franchise').set('Authorization', `Bearer ${adminAuthToken}`).send(newFranchise);
  expect(addFranchiseRes.status).toBe(200);
});

test('deleteFranchise', async () => {
  const newFranchise = {
    name: adminName,
    admins: [{ email: adminEmail }]
  };
  const addFranchiseRes = await request(app).post('/api/franchise').set('Authorization', `Bearer ${adminAuthToken}`).send(newFranchise);

  const deleteFranchiseRes = await request(app).delete('/api/franchise/:franchiseId').set('Authorization', `Bearer ${adminAuthToken}`).send(addFranchiseRes.body);
  expect(deleteFranchiseRes.status).toBe(200);
});

test('createStore', async () => {
  const newStore = {name:"SLC"};

//   const newFranchise = {
//     name: adminName,
//     admins: [{ email: adminEmail }]
//   };
//   const addFranchiseRes = await request(app).post('/api/franchise').set('Authorization', `Bearer ${adminAuthToken}`).send(newFranchise);
  
//   const franchiseId = addFranchiseRes.body.franchiseId;

  const badStoreRes = await request(app).post('/api/franchise/:franchiseId/store').set('Authorization', `Bearer ${testUserAuthToken}`).send(newStore);
  expect(badStoreRes.status).toBe(403);

//   const addStoreRes = await request(app).post(`/api/franchise/${franchiseId}/store`).set('Authorization', `Bearer ${adminAuthToken}`).send(newStore);
//   expect(addStoreRes.status).toBe(200);
});