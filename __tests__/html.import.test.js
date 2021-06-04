const path = require('path');
const moment = require('moment');

const HTMLParser = require('../index');

describe('html import spec', () => {
  const FILE_NONLONGCARE = path.resolve(__dirname, './files/wrong_nonlongcare.html');
  const FILE_NOTE = path.resolve(__dirname, './files/wrong_note.html');
  const FILE_TAG = path.resolve(__dirname, './files/wrong_tag.html');
  const FILE_NAME = path.resolve(__dirname, './files/without_name.html');
  const FILE_GENDER = path.resolve(__dirname, './files/without_gender.html');
  const FILE_BIRTHDAY_NULL = path.resolve(__dirname, './files/without_birthday.html');
  const FILE_BIRTHDAY_FORMAT = path.resolve(__dirname, './files/wrong_birthday.html');
  const FILE_PERSONALID_NULL = path.resolve(__dirname, './files/without_personalId.html');
  const FILE_PERSONALID_FORMAT = path.resolve(__dirname, './files/wrong_personalId.html');
  const FILE_SUCCESS = path.resolve(__dirname, './files/successful_210602.html');
  describe('required variables', () => {
    test('不符合長照資格', async () => {
      await expect(HTMLParser.getHtmlData(FILE_NONLONGCARE)).rejects
        .toEqual(new Error('此檔案格式無法支援'));
    });
    test('不能上傳照會單', async () => {
      await expect(HTMLParser.getHtmlData(FILE_NOTE)).rejects
        .toEqual(new Error('此檔案格式無法支援 (請提供照顧管理評估量表，而非照會單)'));
    });
    test('HTML內未包含規定內容', async () => {
      await expect(HTMLParser.getHtmlData(FILE_TAG)).rejects
        .toEqual(new Error('個案匯入/更新失敗, HTML內未包含規定內容'));
    });
    test('檢查個案姓名是否為空', async () => {
      await expect(HTMLParser.getHtmlData(FILE_NAME)).rejects
        .toEqual(new Error('個案姓名為空'));
    });
    test('檢查個案性別是否為空', async () => {
      await expect(HTMLParser.getHtmlData(FILE_GENDER)).rejects
        .toEqual(new Error('個案性別為空'));
    });
    test('檢查個案生日日期格式是否正確 - 為空', async () => {
      await expect(HTMLParser.getHtmlData(FILE_BIRTHDAY_NULL)).rejects
        .toEqual(new Error('個案生日格式有誤'));
    });
    test('檢查身份證字號是否為本國籍格式 - 為空', async () => {
      await expect(HTMLParser.getHtmlData(FILE_PERSONALID_NULL)).rejects
        .toEqual(new Error('個案身份證字號格式有誤'));
    });
  });
  describe('rules', () => {
    test('檢查個案生日日期格式是否正確 - 非正確日期格式', async () => {
      await expect(HTMLParser.getHtmlData(FILE_BIRTHDAY_FORMAT)).rejects
        .toEqual(new Error('個案生日格式有誤'));
    });
    test('檢查身份證字號是否為本國籍格式 - 非正確身份證字號格式', async () => {
      await expect(HTMLParser.getHtmlData(FILE_PERSONALID_FORMAT)).rejects
        .toEqual(new Error('個案身份證字號格式有誤'));
    });
  });
  describe('successful', () => {
    test('HTML規格正常', async () => {
      const obj = await HTMLParser.getHtmlData(FILE_SUCCESS);

      // version
      expect(obj.version).toBe('');

      // caseInfo
      expect(obj.caseInfo).toBeTruthy();

      // basicInfo
      expect(obj.caseInfo.basicInfo).toBeTruthy();
      expect(obj.caseInfo.basicInfo.applicationDate).toMatch('2021-05-24');

      expect(obj.caseInfo.basicInfo.customer).toBeTruthy();
      expect(obj.caseInfo.basicInfo.customer.aboriginalIdentity).toBe('');
      expect(obj.caseInfo.basicInfo.customer.aboriginalRace).toBe('');
      expect(obj.caseInfo.basicInfo.customer.birthday).toBe('1943-03-04');
      expect(obj.caseInfo.basicInfo.customer.disease).toBe(null);
      expect(obj.caseInfo.basicInfo.customer.employment).toBe('');
      expect(obj.caseInfo.basicInfo.customer.employmentIntention).toBe('');
      expect(obj.caseInfo.basicInfo.customer.foreign).toBe(false);
      expect(obj.caseInfo.basicInfo.customer.gender).toBe('女');
      expect(obj.caseInfo.basicInfo.customer.height).toBe('153.0公分');
      expect(obj.caseInfo.basicInfo.customer.hireCare).toBe('其他');
      expect(obj.caseInfo.basicInfo.customer.hireCareNum).toBe(0);
      expect(obj.caseInfo.basicInfo.customer.hospitalized).toBe('，住院原因（含急診）：');
      expect(Array.isArray(obj.caseInfo.basicInfo.customer.language)).toBe(true);
      expect(obj.caseInfo.basicInfo.customer.language).toHaveLength(1);
      expect(obj.caseInfo.basicInfo.customer.level).toBe('一般戶');
      expect(obj.caseInfo.basicInfo.customer.livingSituation).toBe('獨居');
      expect(obj.caseInfo.basicInfo.customer.name).toBe('蔡戴淑喜');
      expect(Array.isArray(obj.caseInfo.basicInfo.customer.serviceItem)).toBe(true);
      expect(obj.caseInfo.basicInfo.customer.serviceItem).toHaveLength(1);
      expect(obj.caseInfo.basicInfo.customer.personalId).toBe('E200871506');
      expect(obj.caseInfo.basicInfo.customer.phone).toBe('075810707');
      expect(obj.caseInfo.basicInfo.customer.registeredAddress_city).toBe('高雄市');
      expect(obj.caseInfo.basicInfo.customer.registeredAddress_neighborhood).toBe('');
      expect(obj.caseInfo.basicInfo.customer.registeredAddress_others).toBe('63巷18弄22號');
      expect(obj.caseInfo.basicInfo.customer.registeredAddress_region).toBe('左營區');
      expect(obj.caseInfo.basicInfo.customer.registeredAddress_road).toBe('店仔頂路');
      expect(obj.caseInfo.basicInfo.customer.registeredAddress_village).toBe('聖南里');
      expect(obj.caseInfo.basicInfo.customer.serviceAddress_city).toBe('高雄市');
      expect(obj.caseInfo.basicInfo.customer.serviceAddress_neighborhood).toBe('');
      expect(obj.caseInfo.basicInfo.customer.serviceAddress_others).toBe('63巷18弄22號');
      expect(obj.caseInfo.basicInfo.customer.serviceAddress_region).toBe('左營區');
      expect(obj.caseInfo.basicInfo.customer.serviceAddress_road).toBe('店仔頂路');
      expect(obj.caseInfo.basicInfo.customer.serviceAddress_village).toBe('聖南里');
      expect(Array.isArray(obj.caseInfo.basicInfo.customer.livingPartner)).toBe(true);
      expect(obj.caseInfo.basicInfo.customer.livingPartner).toHaveLength(0);
      expect(obj.caseInfo.basicInfo.customer.weight).toBe('40.0公斤');

      expect(obj.caseInfo.basicInfo.disability).toBeTruthy();
      expect(obj.caseInfo.basicInfo.disability.level).toBe('正常');
      expect(obj.caseInfo.basicInfo.disability.note).toBe('無');
      expect(obj.caseInfo.basicInfo.disability.prove).toBe('無');
      expect(obj.caseInfo.basicInfo.disability.system).toBe('新制');

      expect(obj.caseInfo.basicInfo.agent).toBeTruthy();
      expect(obj.caseInfo.basicInfo.agent.personalId).toBe('');
      expect(obj.caseInfo.basicInfo.agent.address).toBe('高雄市左營區聖南里店仔頂路63巷18弄22號');
      expect(obj.caseInfo.basicInfo.agent.email).toBe('');
      expect(obj.caseInfo.basicInfo.agent.phoneC).toBe('0932894993');
      expect(obj.caseInfo.basicInfo.agent.phoneH).toBe('');
      expect(obj.caseInfo.basicInfo.agent.phoneO).toBe('');
      expect(obj.caseInfo.basicInfo.agent.relationNote).toBe('');
      expect(obj.caseInfo.basicInfo.agent.relation).toBe('已婚兒子');

      expect(obj.caseInfo.basicInfo.contact).toBeTruthy();
      expect(obj.caseInfo.basicInfo.contact.address).toBe('高雄市左營區聖南里店仔頂路63巷18弄22號');
      expect(obj.caseInfo.basicInfo.contact.email).toBe('');
      expect(obj.caseInfo.basicInfo.contact.name).toBe('蔡詠竹');
      expect(obj.caseInfo.basicInfo.contact.phoneC).toBe('0932894993');
      expect(obj.caseInfo.basicInfo.contact.phoneH).toBe('');
      expect(obj.caseInfo.basicInfo.contact.phoneO).toBe('');
      expect(obj.caseInfo.basicInfo.contact.relationNote).toBe('');
      expect(obj.caseInfo.basicInfo.contact.relation).toBe('已婚兒子');

      expect(obj.caseInfo.basicInfo.caretaker).toBe('林靜君');
      expect(obj.caseInfo.basicInfo.behavior).toBe('');
      expect(obj.caseInfo.basicInfo.medicalHistory).toBe('');
      expect(obj.caseInfo.basicInfo.education).toBe('03.國小');
      expect(obj.caseInfo.basicInfo.eligibility).toBe('');
      expect(moment(obj.caseInfo.basicInfo.handleTime).format('YYYY-MM-DD HH:mm:ss')).toBe('2021-05-24 00:00:00');
      expect(obj.caseInfo.basicInfo.mentionHandicap).toBe('不符合');
      expect(obj.caseInfo.basicInfo.specialMark).toBe('');
      expect(obj.caseInfo.basicInfo.handicapLevel).toBe('');

      // takeCarePlan
      expect(obj.caseInfo.takeCarePlan).toBeTruthy();
      expect(obj.caseInfo.takeCarePlan.Aintroduction).toBe('1.照顧服務：提供沐浴及洗頭服務，增進案主身體清潔及舒適度；協助代購餐食，維持個案進食與營養攝取頻率；協助陪伴服務，降低個案跌倒風險，減緩照顧者負荷。\r\n2.專業服務：無。\r\n3.交通接送服務：提供交通接送服務，改善外出就醫不便利性。\r\n4.輔具服務及居家無障礙環境改善服務：提供生活輔具建議，提升環境支持度，減少跌倒風險。\r\n5.喘息服務：提供喘息服務，減少照顧者照顧壓力。');
      expect(obj.caseInfo.takeCarePlan.AExecution).toBe('1.B碼照顧服務：\r\n-BA07[協助沐浴及洗頭]*23組/月（每週5次）\r\n-BA16-1[代購或代領或代送服務(自用)]*46組/月（每週5次）\r\n-BA20[陪伴服務]*23組/月（每週5次，1次30分）\r\n2.C碼專業服務：無。\r\n3.D碼交通接送服務：每月2000元，輪派速優國際有限公司。\r\n4.EF碼輔具及居家無障礙環境改善服務：實際提供項目、長度、款式請參見環改及輔具評估建議書提供。\r\n-EA01-3[沐浴椅]*1\r\n-FA10[居家無障礙設施-防滑措施]*1\r\n備註：已告知輔具申請流程。\r\n5.G碼喘息服務：\r\n-GA09[居家喘息服務]*32340元/年，起訖月110/05-111/04。\r\n\r\n電訪日期：110/05/25，送審日期：110/05/26');
      expect(obj.caseInfo.takeCarePlan.AMemo).toBe('1.是否有夜間服務需求(AA08)：否。\r\n2.是否有週六、週日接受服務需求(AA09)：是，B、G碼。（代購服務偶會有假日使用需求）\r\n3.案子提出陪伴服務想增加30分，因額度不足，案子表示會與居服單位討論自費。\r\n4.個案因喪偶後獨居，案子提出放假返家探視時，可協助個案備餐，故案子可協助的時段，會暫停當次的代購服務。\r\n5.案子告知目前申請外籍看護期間使用居服，個案照顧安排會以外勞照顧為主，個管已告知申請外勞可使用之長照服務項目，案子知悉。');
      expect(obj.caseInfo.takeCarePlan.AContact).toBeTruthy();
      expect(obj.caseInfo.takeCarePlan.AContact.unit).toBe('復能職能治療所(A)');
      expect(obj.caseInfo.takeCarePlan.AContact.name).toBe('余宜君');
      expect(obj.caseInfo.takeCarePlan.AContact.telephone).toBe('07-5509456');
      expect(obj.caseInfo.takeCarePlan.AContact.email).toBe('reabletwa@gmail.com');
      expect(Array.isArray(obj.caseInfo.takeCarePlan.APlanItem)).toBe(true);
      expect(obj.caseInfo.takeCarePlan.APlanItem).toHaveLength(9);
      expect(obj.caseInfo.takeCarePlan.CMSLevel).toBe('第4級');
      expect(obj.caseInfo.takeCarePlan.bundled).toBeTruthy();
      expect(obj.caseInfo.takeCarePlan.bundled.allowance).toBe(15608);
      expect(obj.caseInfo.takeCarePlan.bundled.pays).toBe(2972);
      expect(obj.caseInfo.takeCarePlan.bundled.priceType).toBe('一般價格');
      expect(obj.caseInfo.takeCarePlan.bundled.quota).toBe(18580);
      expect(obj.caseInfo.takeCarePlan.bundled.workerCare).toBe('外籍看護:無特照津貼:無');
      expect(obj.caseInfo.takeCarePlan.bundledG).toBeTruthy();
      expect(obj.caseInfo.takeCarePlan.bundledG.allowance).toBe(27166);
      expect(obj.caseInfo.takeCarePlan.bundledG.pays).toBe(5174);
      expect(obj.caseInfo.takeCarePlan.bundledG.quota).toBe(32340);
      expect(Array.isArray(obj.caseInfo.takeCarePlan.bundledItem)).toBe(true);
      expect(obj.caseInfo.takeCarePlan.bundledItem).toHaveLength(9);
      expect(Array.isArray(obj.caseInfo.takeCarePlan.signSupervisor)).toBe(true);
      expect(obj.caseInfo.takeCarePlan.signSupervisor).toHaveLength(1);
      expect(obj.caseInfo.takeCarePlan.contractVersion).toBe('2.1');
      expect(obj.caseInfo.takeCarePlan.disabilityProve).toBe('否');
      expect(obj.caseInfo.takeCarePlan.evaluateDate).toBe('110/05/25-林佳穎');
      expect(obj.caseInfo.takeCarePlan.introduction).toBe('一、個案狀況摘要\r\n1.受訪者：案主及案子。\r\n2.特殊疾病狀況：案主罹患高血壓、糖尿病、高血脂、雙眼白內障術後、雙膝關節置換術後、脊椎側彎、骨質疏鬆、109年小中風，現脊椎疼痛不適，因疫情緣故無法住院治療，定期於大同及高醫就醫，案主意識清楚，理解及表達能力良好，現有憂鬱情緒，雙膝活動略有受限，曾於門口跌倒3次，移位起身需他人部份協助，需攙扶才可簡易行走，無法上下樓梯，外出使用輪椅代步，就醫需要他人陪同，沐浴及穿衣需要他人協助，小便偶爾失禁，家事及備餐需要他人協助，藥物需監督提醒服用。\r\n3.家庭狀況：案主喪偶，獨居，育有1子1女(男/女)；案夫於110/5/22急性心肌哽塞往生；案女已婚居住仁武，不定時返家探視；案子居住於案家附近，為三班輪班工作，每天往返照顧案主，現仍需處理案夫後事，預計於110/5/31移除靈堂，感到照顧負荷重。\r\n二、服務建議：\r\n1.照顧服務：建議使用協助沐浴及洗頭、代購餐點及陪伴服務。\r\n2.專業服務：暫無服務需求。\r\n3.交通接送服務：使用多元計程車協助就醫交通接駁，案家欲輪派即可。\r\n4.輔具服務及居家無障礙環境改善服務：案家已有自購輪椅、便盆椅及枴杖，建議安裝浴廁扶手、改善洗臉台、防滑措施及購買沐浴椅，以維護案主安全，案家仍考慮中。\r\n5.喘息服務：使用居家喘息取代照顧者外出時的照顧工作。\r\n6.其他：B碼及G碼有假日服務需求。\r\n三、特殊交班事項：\r\n1.案家長照額度不足部分，欲轉由與居服單位討論自費增加。\r\n2.案主預計3個月後轉由外籍看護照顧，現因案家庭狀況，家中白天無照顧替代人力，故需加速核定長照服務項目，待轉復能-A個管師電訪核定後續服務項目。\r\n訪視評估日：110/5/25因疫情緣故A個管無訪共訪；計畫完成日：110/5/25；照顧管理專員/林佳穎。');
      expect(obj.caseInfo.takeCarePlan.itemAA06IncludeBA12).toBe(false);
      expect(obj.caseInfo.takeCarePlan.itemAA08).toBeTruthy();
      expect(obj.caseInfo.takeCarePlan.itemAA08.B).toBe(false);
      expect(obj.caseInfo.takeCarePlan.itemAA08.C).toBe(false);
      expect(obj.caseInfo.takeCarePlan.itemAA09).toBeTruthy();
      expect(obj.caseInfo.takeCarePlan.itemAA09.B).toBe(true);
      expect(obj.caseInfo.takeCarePlan.itemAA09.C).toBe(false);
      expect(obj.caseInfo.takeCarePlan.itemAA09.G).toBe(true);
      expect(obj.caseInfo.takeCarePlan.itemAA09.G).toBe(true);
      expect(obj.caseInfo.takeCarePlan.modifyReason).toBe('');
      expect(obj.caseInfo.takeCarePlan.planType).toBe('初評');
      expect(obj.caseInfo.takeCarePlan.theme).toBe('');
      expect(obj.caseInfo.takeCarePlan.writeOff).toBe('依居住地');
      expect(obj.caseInfo.takeCarePlan.isACareTaker).toBe(true);
      expect(obj.caseInfo.takeCarePlan.dischargeHospital).toBe('');
      expect(obj.caseInfo.takeCarePlan.changeSummary).toBe('');
      expect(obj.caseInfo.takeCarePlan.bundledActive).toBe('不啟用');
      expect(obj.caseInfo.takeCarePlan.planChangeReason).toBe('');

      // evaluation
      expect(obj.caseInfo.evaluation).toBeTruthy();
      expect(obj.caseInfo.evaluation.helper).toBeTruthy();
      expect(obj.caseInfo.evaluation.helper.primaryAge).toBe(53);
      expect(obj.caseInfo.evaluation.helper.primaryGender).toBe('男');
      expect(obj.caseInfo.evaluation.helper.primaryName).toBe('蔡詠竹');
      expect(obj.caseInfo.evaluation.helper.primaryRelation).toBe('兒子');
      expect(obj.caseInfo.evaluation.helper.secondaryName).toBe('');
      expect(obj.caseInfo.evaluation.helper.secondaryRelation).toBe('');

      expect(Array.isArray(obj.caseInfo.evaluation.ADLs)).toBe(true);
      expect(obj.caseInfo.evaluation.ADLs).toHaveLength(11);

      expect(Array.isArray(obj.caseInfo.evaluation.IADLs)).toBe(true);
      expect(obj.caseInfo.evaluation.IADLs).toHaveLength(8);
    });
    test('計算超額自付', () => {
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
