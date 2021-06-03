const path = require('path');

const HTMLParser = require('../index');

describe('html import spec', () => {
  const fileA = path.resolve(__dirname, './files/wrong_nonlongcare.html');
  const fileB = path.resolve(__dirname, './files/wrong_note.html');
  const fileC = path.resolve(__dirname, './files/wrong_tag.html');
  const file = path.resolve(__dirname, './files/successful_210602.html');
  beforeAll(async () => { });
  afterAll(async () => { });
  describe('required variables', () => {
    test('不符合長照資格', async () => {
      await expect(HTMLParser.getHtmlData(fileA)).rejects
        .toEqual(new Error('此檔案格式無法支援'));
    });
    test('不能上傳照會單', async () => {
      await expect(HTMLParser.getHtmlData(fileB)).rejects
        .toEqual(new Error('此檔案格式無法支援 (請提供照顧管理評估量表，而非照會單)'));
    });
    test('HTML內未包含規定內容', async () => {
      await expect(HTMLParser.getHtmlData(fileC)).rejects
        .toEqual(new Error('個案匯入/更新失敗, HTML內未包含規定內容'));
    });
  });
  describe('rules', () => {});
  describe('successful', () => {
    test('HTML規格正常', async () => {
      const obj = await HTMLParser.getHtmlData(file);
      expect(obj.basicInfo).toBeTruthy();
      expect(obj.basicInfo.customer).toBeTruthy();
      expect(obj.basicInfo.customer.name).toBe('蔡戴淑喜');
      expect(obj.basicInfo.customer.gender).toBe('女');
      expect(obj.basicInfo.customer.personalId).toBe('E200871506');
      expect(obj.basicInfo.customer.phone).toBe('075810707');
      expect(obj.basicInfo.customer.height).toBe('153.0公分');
      expect(obj.basicInfo.customer.weight).toBe('40.0公斤');
      expect(obj.basicInfo.customer.livingSituation).toBe('獨居');

      expect(obj.basicInfo.applicationDate).toMatch('2021-05-24');

      expect(obj.takeCarePlan).toBeTruthy();
      expect(Array.isArray(obj.takeCarePlan.bundledItem)).toBe(true);

      expect(obj.takeCarePlan.bundledItem).toHaveLength(9);
      expect(obj.takeCarePlan.dischargeHospital).toBe('');
    });
    test('算超額自付', () => {
      const saveObj = [];
      saveObj.push({
        serviceCode: 'BA01',
        amount: 100,
        cost: 5,
      });
      saveObj.push({
        serviceCode: 'BA02',
        amount: 50,
        cost: 2,
      });
      saveObj.push({
        serviceCode: 'AA01',
        amount: 5000,
        cost: 5,
      });
      const quota = 10000;
      expect(HTMLParser.calculateOverdueFee(saveObj, quota)).toBe(0);
    });
  });
});
