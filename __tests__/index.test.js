const { hello } = require('../index');

describe('index test', () => {
  test('hello world', () => {
    expect(hello()).toBe('hello world');
  });
});
