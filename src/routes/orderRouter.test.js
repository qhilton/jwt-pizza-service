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

test('getMenu', async () => {
  const getMenuRes = await request(app).get('/api/order/menu');
  expect(getMenuRes.status).toBe(200);

  // const expectedMenu = { id: 1, title: 'Veggie', image: 'pizza1.png', price: 0.0038, description: 'A garden of delight' };
  // expect(getMenuRes.body[0]).toMatchObject(expectedMenu);
}); 

test('addMenuItem', async () => {
  const newMenuItem = { "title":"Student", "description": "No topping, no sauce, just carbs", "image":"pizza9.png", "price": 0.0001 };

  const addMenuRes = await request(app).put('/api/order/menu').set('Authorization', `Bearer ${adminAuthToken}`).send(newMenuItem);
  expect(addMenuRes.status).toBe(200);

  
  const addMenuResFail = await request(app).put('/api/order/menu').set('Authorization', `Bearer ${testUserAuthToken}`).send(newMenuItem);
  expect(addMenuResFail.status).toBe(403);
});

test('getOrders', async () => {
  const addMenuRes = await request(app).get('/api/order').set('Authorization', `Bearer ${adminAuthToken}`);
  expect(addMenuRes.status).toBe(200);
});

test('createOrder', async () => {
  const order = {"franchiseId": 1, "storeId":1, "items":[{ "menuId": 1, "description": "Veggie", "price": 0.05 }]};
  const createOrderRes = await request(app).post('/api/order').set('Authorization', `Bearer ${adminAuthToken}`).send(order);
  expect(createOrderRes.status).toBe(200); 

  // const badOrderRes = await request(app).post('/api/order').set('Authorization', `Bearer ${adminAuthToken}`);
  // expect(badOrderRes.status).toBe(500);
});