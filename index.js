const fs = require('fs').promises;
const moment = require('moment');
const { fromString } = require('html-to-text');
const taiwanIdValidator = require('taiwan-id-validator2');
const { StringUtil, HTMLEnums, CasePlanObject } = require('./lib');

const PLAN_ENUMS = HTMLEnums.HTMLEnums;
let _textArray = [];

/**
 * 在字串陣列中，從keyword跟delimiter之間，取出自keyword 後面數來第i個element
 * @param {String} keyword
 * @param {String} delimiter
 * @param {Number} index
 * @returns {String} data
 */
const getTextByKeyword = (keyword, delimiter, index = 1) => {
  let data = '';
  if (_textArray.length === 0) {
    return data;
  }
  if (_textArray.indexOf(keyword) >= 0) {
    data = _textArray[_textArray.indexOf(keyword) + index];
    data = (data === delimiter ? '' : data);
  }
  return data;
};

/**
 * 將html中的服務項目做資料轉換
 * @param {String} keyword
 * @param {String} delimiter
 * @param {String} regexp
 * @returns {Object} result
 */
const getHtmlServiceItem = (keyword, delimiter, regexp) => {
  const result = {
    serviceItems: [],
    isNewItem: false,
    msg: '',
  };
  let serviceItemIndex = _textArray.indexOf(keyword);
  let whileCounter = 0;

  while ((_textArray[serviceItemIndex + 1] !== PLAN_ENUMS.ITEM) && (_textArray[serviceItemIndex + 2] !== PLAN_ENUMS.ITEM)) {
    whileCounter += 1;
    if (whileCounter > 1000) {
      result.msg = `${PLAN_ENUMS.ERROR_UPLOAD_FAILED_MSG}${keyword}`
      return result;
    }
    _textArray.splice(serviceItemIndex, 1);
    serviceItemIndex = _textArray.indexOf(keyword);
  }
  let serviceItemEndIndex = _textArray.indexOf(delimiter);
  while ((_textArray[serviceItemEndIndex + 1] !== PLAN_ENUMS.ITEM) && (_textArray[serviceItemEndIndex + 2] !== PLAN_ENUMS.ITEM)) {
    whileCounter += 1;
    if (whileCounter > 1000) {
      result.msg = `${PLAN_ENUMS.ERROR_UPLOAD_FAILED_MSG}${keyword}`;
      return result;
    }
    _textArray.splice(serviceItemEndIndex, 1);
    serviceItemEndIndex = _textArray.indexOf(delimiter);
  }
  const indexArr = [];
  for (let i = serviceItemIndex + 1; i < serviceItemEndIndex; i++) {
    if (regexp.test(_textArray[i])) {
      indexArr.push(i);
    }
  }
  for (let i = 0; i < indexArr.length; i++) {
    const numArr = [];
    const columnLimitNum = 8; // 用來限制在一列中要解析的欄位數量
    // 取得服務項目界線(在一列中要分析的欄位數量)
    // 最後一列用常數來限制數量，其他採用列與列之間的距離
    const end = (i + 1) < indexArr.length ? indexArr[i + 1] - indexArr[i] : columnLimitNum;
    for (let j = 1; j < end; j++) {
      if (/^\d+/.test(_textArray[indexArr[i] + j])) {
        numArr.push(_textArray[indexArr[i] + j].replace(PLAN_ENUMS.DOLLAR, ''));
      }
    }
    if (/(10712|BA05-|BA23|BA24|BA09a)/.test(_textArray[indexArr[i]])) {
      result.isNewItem = true;
    }
    if (numArr.length > 1) {
      result.serviceItems.push({
        item: _textArray[indexArr[i]],
        price: numArr.length > 0 ? numArr[0] : 0,
        amount: numArr.length > 1 ? numArr[1] : 0,
        total: numArr.length > 2 ? numArr[2] : 0,
        itemType: _textArray[indexArr[i]].substr(0, 1),
        newItem: /(10712|BA05-|BA23|BA24|BA09a)/.test(_textArray[indexArr[i]]),
      });
    }
  }
  return result;
};

const getAUnitServiceItem = (arrayObj) => {
  let serviceItemStartIndex = _textArray.indexOf(PLAN_ENUMS.CASE_MGMT_TAKECARE_PLAN);
  if (serviceItemStartIndex > 0 && _textArray[serviceItemStartIndex + 1].includes(PLAN_ENUMS.A_UNIT)
    && _textArray[serviceItemStartIndex + 2] === PLAN_ENUMS.ITEM) {
    serviceItemStartIndex += 2;
  } else {
    serviceItemStartIndex = -1;
  }

  let serviceItemEndIndex = -1;
  serviceItemEndIndex = _textArray.indexOf(PLAN_ENUMS.A_QUESTION_LIST);

  if (serviceItemStartIndex > 0 && serviceItemEndIndex > 0) {
    let numIndex = 1;
    let prevIndex = -1;
    let diffLength = 0;
    const columnLimit = [2, 3, 5];
    for (let i = serviceItemStartIndex + 1; i < serviceItemEndIndex; i++) {
      if (_textArray[i] === numIndex.toString()) {
        if (numIndex === 1) {
          prevIndex = i;
          numIndex++;
          continue;
        }

        diffLength = (i - prevIndex);

        if (columnLimit.includes(diffLength)) {
          arrayObj.push({
            item: _textArray[prevIndex + 1],
            name: diffLength === 5 ? _textArray[prevIndex + 2] : '',
            unit: diffLength === 5 ? _textArray[prevIndex + 3] : '',
            reason: diffLength >= 3 ? _textArray[prevIndex + diffLength - 1] : '',
          });
          prevIndex = i;
          numIndex++;
        }
      }
    }
    if (numIndex > 1 && columnLimit.includes(diffLength)) {
      arrayObj.push({
        item: _textArray[prevIndex + 1],
        name: diffLength === 5 ? _textArray[prevIndex + 2] : '',
        unit: diffLength === 5 ? _textArray[prevIndex + 3] : '',
        reason: diffLength >= 3 ? _textArray[prevIndex + diffLength - 1] : '',
      });
    }
    return true;
  }
  return false;
};

class HTMLParser {
  /**
   * 取得HtmlData
   * @param {File} file HTML檔
   * @returns {Promise.<CasePlanObject>} Promise.<CasePlanObject>
   */
  static async getHtmlData(file) {
    const options = { tables: ['text-required'], wordwrap: false };
    const fileString = await fs.readFile(file, 'utf8');
    const textAll = fromString(fileString, options);
    const dateFormat = 'YYYY-MM-DD';

    let text = '';
    text = textAll.replace(/\n\n/g, ' ');
    text = text.replace(/＊|※/g, '');
    text = text.replace(/勾選後此區不列印/g, '');
    text = text.replace(PLAN_ENUMS.BUY_ASSISTIVE, '');
    _textArray = text.split(' ');
    const casePlanObject = new CasePlanObject();
    const CSData = casePlanObject.caseInfo;

    // 不符合長照資格，則回傳錯誤訊息
    if (!_textArray.includes(PLAN_ENUMS.LONG_CARE_QUALIFICATION)) {
      throw new Error('此檔案格式無法支援');
    }
    // 不能上傳照會單，則回傳錯誤訊息
    if (_textArray.includes(PLAN_ENUMS.NOTE) && _textArray.indexOf(PLAN_ENUMS.NOTE) < 10) {
      throw new Error('此檔案格式無法支援 (請提供照顧管理評估量表，而非照會單)');
    }

    // 主旨、異動摘要 Index
    const changeSummaryIndex = _textArray.indexOf(PLAN_ENUMS.THEME);
    CSData.takeCarePlan.changeSummary = '';
    // 計畫異動原因 Index
    const planChangeReasonIndex = _textArray.indexOf(PLAN_ENUMS.PLAN_CHANGE_REASON);
    CSData.takeCarePlan.planChangeReason = '';
    // 計畫簡述 Index
    let planIntroductionIndex = _textArray.indexOf(PLAN_ENUMS.PLAN_DESCRIPTION);

    if ((_textArray[planIntroductionIndex + 1] === PLAN_ENUMS.THEME) || (_textArray[planIntroductionIndex + 2] === PLAN_ENUMS.THEME)) {
      _textArray.splice(planIntroductionIndex, 1);
    }
    planIntroductionIndex = _textArray.indexOf(PLAN_ENUMS.PLAN_DESCRIPTION);
    CSData.takeCarePlan.introduction = '';
    // A單位計畫簡述 Index
    let aUnitPlanStartIndex = _textArray.indexOf(PLAN_ENUMS.QUESTION);
    let aUnitPlanEndIndex = _textArray.indexOf(PLAN_ENUMS.A_CONTACT);
    // A單位個管聯絡資訊 Index
    let aUnitContactStartIndex = aUnitPlanEndIndex;
    let aUnitContactEndIndex = _textArray.indexOf(PLAN_ENUMS.CARE_PROFESSIONAL_SERVICE_MONTH);

    if (aUnitPlanStartIndex !== -1 && aUnitPlanEndIndex !== -1
      && _textArray[aUnitPlanStartIndex + 1].includes(PLAN_ENUMS.A_UNIT)
      && _textArray[aUnitPlanEndIndex + 1].includes(PLAN_ENUMS.A_UNIT)) {
      aUnitPlanStartIndex += 1;
      aUnitPlanEndIndex += 1;
    }
    if (aUnitContactStartIndex !== -1 && aUnitContactEndIndex !== -1
      && _textArray[aUnitContactStartIndex + 1].includes(PLAN_ENUMS.A_UNIT)
      && _textArray[aUnitContactEndIndex + 1].includes(PLAN_ENUMS.SEARCH_SERVICE_DETAIL)) {
      aUnitContactStartIndex += 1;
      aUnitContactEndIndex += 1;
    }

    // 主旨、異動摘要
    if (changeSummaryIndex !== -1) {
      const endIndex = planChangeReasonIndex !== -1 ? planChangeReasonIndex : planIntroductionIndex;
      for (let i = changeSummaryIndex + 1; i < endIndex; i++) {
        CSData.takeCarePlan.theme += _textArray[i];
      }
    }

    // 計畫異動原因
    if (planChangeReasonIndex !== -1) {
      for (let i = planChangeReasonIndex + 1; i < planIntroductionIndex; i++) {
        CSData.takeCarePlan.modifyReason += _textArray[i];
      }
    }

    // 計畫簡述
    if (planIntroductionIndex !== -1) {
      let endIndex = _textArray.indexOf(PLAN_ENUMS.CASE_WISH);
      if (endIndex === -1) {
        endIndex = _textArray.indexOf(PLAN_ENUMS.CARE_PLAN);
      }
      for (let i = planIntroductionIndex + 1; i < endIndex; i++) {
        CSData.takeCarePlan.introduction += _textArray[i];
      }
    }

    // A單位計畫簡述
    if ((aUnitPlanStartIndex !== -1) && (aUnitPlanEndIndex !== -1)) {
      let introIndex = -1;
      let execIndex = -1;
      let memoIndex = -1;
      for (let i = aUnitPlanStartIndex + 1; i < aUnitPlanEndIndex; i++) {
        if (_textArray[i] === PLAN_ENUMS.PLAN_DESTINATION) {
          introIndex = i;
        }
        if (_textArray[i] === PLAN_ENUMS.PLAN_EXEC) {
          execIndex = i;
        }
        if (_textArray[i] === PLAN_ENUMS.OTHER_NOTE) {
          memoIndex = i;
        }
      }
      if (introIndex > 0 && execIndex > 0) {
        for (let i = introIndex + 3; i < execIndex; i++) {
          CSData.takeCarePlan.Aintroduction += _textArray[i];
        }
      }
      if (execIndex > 0 && memoIndex > 0) {
        for (let i = execIndex + 3; i < memoIndex; i++) {
          CSData.takeCarePlan.AExecution += _textArray[i];
        }
      }
      if (memoIndex > 0 && aUnitPlanEndIndex > 0) {
        for (let i = memoIndex + 3; i < aUnitPlanEndIndex - 1; i++) {
          CSData.takeCarePlan.AMemo += _textArray[i];
        }
      }
    }

    text = text.replace(/\r\n|\n/g, '');
    _textArray = text.split(' ');

    // A單位個管聯絡資訊
    if ((aUnitContactStartIndex !== -1) && (aUnitContactEndIndex !== -1)) {
      for (let i = aUnitContactStartIndex + 1; i < aUnitContactEndIndex; i++) {
        if (_textArray[i].includes(PLAN_ENUMS.A_UNIT_NAME) && _textArray[i + 1] !== '') {
          CSData.takeCarePlan.AContact.unit = _textArray[i + 1];
        }
        if (_textArray[i].includes(PLAN_ENUMS.A_CARE_TAKER_NAME) && _textArray[i + 1] !== '') {
          CSData.takeCarePlan.AContact.name = _textArray[i + 1];
        }
        if (_textArray[i].includes(PLAN_ENUMS.CONTACT_PHONE) && _textArray[i + 1] !== '') {
          CSData.takeCarePlan.AContact.telephone = _textArray[i + 1];
        }
        if (_textArray[i].includes(PLAN_ENUMS.E_MAIL) && _textArray[i + 1] !== '') {
          CSData.takeCarePlan.AContact.email = _textArray[i + 1];
        }
      }
    }

    CSData.basicInfo.applicationDate = StringUtil.getDate(_textArray[_textArray.indexOf(PLAN_ENUMS.APPLICATION_DATE) + 1]);
    CSData.basicInfo.caretaker = getTextByKeyword( PLAN_ENUMS.UNDERTAKER, PLAN_ENUMS.PROCESS_TIME);

    // 整理服務項目
    const serviceItemBC =  getHtmlServiceItem(PLAN_ENUMS.CARE_PROFESSIONAL_SERVICE_MONTH, PLAN_ENUMS.TRANSPORTATION, /^(B|C)/);
    const serviceItemD =  getHtmlServiceItem(PLAN_ENUMS.TRANSPORTATION, PLAN_ENUMS.ASSISTIVE_SERVICE, /^D/);
    const serviceItemEF =  getHtmlServiceItem(PLAN_ENUMS.ASSISTIVE_SERVICE, PLAN_ENUMS.RESPITE_SERVICE_YEAR, /^(E|F)/);
    const serviceItemG =  getHtmlServiceItem(PLAN_ENUMS.RESPITE_SERVICE_YEAR, PLAN_ENUMS.OTHER, /^G/);

    CSData.takeCarePlan.hasNewItem = serviceItemBC.isNewItem;
    CSData.takeCarePlan.bundledItem = [ ...serviceItemBC.serviceItems,  ...serviceItemD.serviceItems,  ...serviceItemEF.serviceItems, ...serviceItemG.serviceItems ];

    // HTML內未包含規定內容
    if (serviceItemBC.msg) {
      throw new Error('個案匯入/更新失敗, HTML內未包含規定內容');
    }

    // 個案管理照顧計畫項目
    getAUnitServiceItem(CSData.takeCarePlan.APlanItem);

    CSData.basicInfo.customer.name = getTextByKeyword(PLAN_ENUMS.NAME, PLAN_ENUMS.BIRTHDAY, 2);
    // 檢查個案姓名是否為空
    if (!CSData.basicInfo.customer.name) {
      throw new Error('個案姓名為空');
    }
    const nameIndex = _textArray.indexOf(PLAN_ENUMS.TRADITIONAL_NAME);
    if (nameIndex !== -1) {
      const origName = _textArray[nameIndex + 2];
      if (origName !== '') {
        CSData.basicInfo.customer.name += `(${origName})`;
      }
    }
    CSData.basicInfo.customer.gender = getTextByKeyword(PLAN_ENUMS.GENDER, PLAN_ENUMS.LIVING_SITUATION);
    // 檢查個案性別是否為空
    if (!CSData.basicInfo.customer.gender) {
      throw new Error('個案性別為空');
    }
    CSData.basicInfo.customer.birthday = StringUtil.getDate(_textArray[_textArray.indexOf(PLAN_ENUMS.BIRTHDAY) + 1]);
    // 檢查個案生日日期格式是否正確
    if (!CSData.basicInfo.customer.birthday) {
      throw new Error('個案生日格式有誤');
    }
    CSData.basicInfo.customer.personalId = getTextByKeyword(PLAN_ENUMS.PERSONAL_ID, PLAN_ENUMS.PHONE);
    // 檢查身份證字號是否為空
    if (!CSData.basicInfo.customer.personalId) {
      throw new Error('個案身份證字號格式有誤');
    }
    // 檢查身份證字號是否為本國籍格式
    if (!taiwanIdValidator.isNationalIdentificationNumberValid(CSData.basicInfo.customer.personalId)) {
      throw new Error('個案身份證字號格式有誤');
    }

    const handleTimeStr = _textArray[_textArray.indexOf(PLAN_ENUMS.PROCESS_TIME) + 1].split('/');
    const handleTime = moment(`${parseInt(handleTimeStr[0], 10) + 1911}-${handleTimeStr[1]}-${handleTimeStr[2]}`, dateFormat).toDate();
    CSData.basicInfo.handleTime = handleTime;
    CSData.basicInfo.eligibility = getTextByKeyword(PLAN_ENUMS.LONG_CARE_QUALIFICATION, PLAN_ENUMS.INCONSISTENT_STATUS);
    const foreign = _textArray[_textArray.indexOf(PLAN_ENUMS.PERSONAL_ID) + 2];
    if (/外籍/.test(foreign) && /checkbox_checked/.test(foreign)) {
      CSData.basicInfo.customer.foreign = true;
    }
    CSData.basicInfo.customer.phone = '';
    for (let i = _textArray.indexOf(PLAN_ENUMS.PHONE) + 1; i < _textArray.indexOf(PLAN_ENUMS.NAME); i++) {
      CSData.basicInfo.customer.phone += _textArray[i] || '';
    }
    const aboriginalIdentity = getTextByKeyword(PLAN_ENUMS.ABORIGINAL_IDENTITY, PLAN_ENUMS.ABORIGINAL_RACE);
    if (aboriginalIdentity !== PLAN_ENUMS.NO) {
      CSData.basicInfo.customer.aboriginalIdentity = aboriginalIdentity;
    }
    const aboriginalRace = getTextByKeyword(PLAN_ENUMS.ABORIGINAL_RACE, PLAN_ENUMS.GENDER);
    if (aboriginalRace !== '') {
      CSData.basicInfo.customer.aboriginalRace = aboriginalRace;
    }
    const bmiIndex = _textArray.indexOf(PLAN_ENUMS.BMI);
    const bmi = _textArray[bmiIndex + 1];
    const bmi2 = _textArray[bmiIndex + 2];
    const weight1 = bmi.match(/[0-9.]+公斤/) ? bmi.match(/[0-9.]+公斤/)[0] : '';
    const weight2 = bmi2.match(/[0-9.]+公斤/) ? bmi2.match(/[0-9.]+公斤/)[0] : '';
    CSData.basicInfo.customer.height = /[0-9.]+公分/.test(bmi) ? bmi.match(/[0-9.]+公分/)[0] : '';
    CSData.basicInfo.customer.weight = weight1 || weight2;
    CSData.basicInfo.customer.livingSituation = StringUtil.getMatchText(_textArray[_textArray.indexOf(PLAN_ENUMS.LIVING_SITUATION_Q) + 1], /[^0-9.]+/g);
    if (CSData.basicInfo.customer.livingSituation === `【${PLAN_ENUMS.SKIP_ANSWER}`) {
      CSData.basicInfo.customer.livingSituation = null;
    }
    if (!CSData.basicInfo.customer.livingSituation) {
      CSData.basicInfo.customer.livingSituation = _textArray[_textArray.indexOf(PLAN_ENUMS.LIVING_SITUATION) + 1];
    }
    const livePartnerIdx = _textArray.indexOf(PLAN_ENUMS.LIVING_PARTNER_Q);
    if (livePartnerIdx > 0) {
      const livePartner = _textArray[livePartnerIdx + 1].split(`${PLAN_ENUMS.CHECK_GIF}]`);
      for (let i = 1; i < livePartner.length; i++) {
        const from = livePartner[i].indexOf('.') + 1;
        const to = livePartner[i].indexOf('[');
        CSData.basicInfo.customer.livingPartner.push(livePartner[i].substr(from, to - from));
      }
    }

    // 戶籍地址
    const registerAddressIndex = _textArray.indexOf(PLAN_ENUMS.REGISTERED_ADDRESS);
    const serviceAddressIndex = _textArray.indexOf(PLAN_ENUMS.SERVICE_ADDRESS);
    const languageIndex = _textArray.indexOf(PLAN_ENUMS.LANGUAGE);
    let registerAddress = _textArray.slice(registerAddressIndex + 3, serviceAddressIndex).join('');

    registerAddress = StringUtil.splitAddress(registerAddress);
    CSData.basicInfo.customer.registeredAddress_city = registerAddress.city.replace('台', '臺');
    CSData.basicInfo.customer.registeredAddress_region = registerAddress.region.replace('台', '臺');
    CSData.basicInfo.customer.registeredAddress_village = registerAddress.village.replace('台', '臺');
    CSData.basicInfo.customer.registeredAddress_neighborhood = registerAddress.neighborhood;
    CSData.basicInfo.customer.registeredAddress_road = registerAddress.road;
    CSData.basicInfo.customer.registeredAddress_others = registerAddress.theRest;

    // 居住(通訊)地址
    let serviceAddress = _textArray.slice(serviceAddressIndex + 3, languageIndex).join('');

    serviceAddress = StringUtil.splitAddress(serviceAddress);
    CSData.basicInfo.customer.serviceAddress_city = serviceAddress.city.replace('台', '臺');
    CSData.basicInfo.customer.serviceAddress_region = serviceAddress.region.replace('台', '臺');
    CSData.basicInfo.customer.serviceAddress_village = serviceAddress.village.replace('台', '臺');
    CSData.basicInfo.customer.serviceAddress_neighborhood = serviceAddress.neighborhood;
    CSData.basicInfo.customer.serviceAddress_road = serviceAddress.road;
    CSData.basicInfo.customer.serviceAddress_others = serviceAddress.theRest;
    for (let i = 1; i < 6; i++) {
      if (_textArray[_textArray.indexOf(PLAN_ENUMS.LANGUAGE) + i].search(PLAN_ENUMS.CHECK_BOX) > 0) {
        CSData.basicInfo.customer.language.push(_textArray[_textArray.indexOf(PLAN_ENUMS.LANGUAGE) + i].split(']')[1]);
      }
    }

    let customerLevel = '';
    let planUpdateCustomerLevel = '';
    while (_textArray.indexOf(PLAN_ENUMS.LONG_CARE_STATUS) !== -1) {
      // 如照顧計畫區塊有更新的福利身份, 則以此為主
      if (_textArray[_textArray.indexOf(PLAN_ENUMS.LONG_CARE_STATUS) - 3] === PLAN_ENUMS.PLAN_CATEGORY) {
        planUpdateCustomerLevel = _textArray[_textArray.indexOf(PLAN_ENUMS.LONG_CARE_STATUS) + 1];
      } else {
        customerLevel = _textArray[_textArray.indexOf(PLAN_ENUMS.LONG_CARE_STATUS) + 1];
      }
      _textArray.splice(_textArray.indexOf(PLAN_ENUMS.LONG_CARE_STATUS), 1);
    }
    if (!customerLevel) {
      customerLevel = _textArray[_textArray.indexOf(PLAN_ENUMS.LONG_CARE_LEVEL) + 1];
    }
    CSData.basicInfo.customer.level = planUpdateCustomerLevel || customerLevel;

    CSData.basicInfo.customer.employment = getTextByKeyword(PLAN_ENUMS.EMPLOYMENT, PLAN_ENUMS.EMPLOYMENT_INTENTION);
    CSData.basicInfo.customer.employmentIntention = getTextByKeyword(PLAN_ENUMS.EMPLOYMENT_INTENTION, PLAN_ENUMS.CURRENT_LIVING_INSTITUTION);
    CSData.basicInfo.customer.hospitalized = getTextByKeyword(PLAN_ENUMS.HOSPITALIZED, PLAN_ENUMS.HIRE_CARE);
    CSData.basicInfo.customer.hireCare = getTextByKeyword(PLAN_ENUMS.HIRE_CARE, PLAN_ENUMS.HIRE_CARE_NUM);
    CSData.basicInfo.customer.hireCareNum = parseInt(getTextByKeyword(PLAN_ENUMS.HIRE_CARE_NUM, PLAN_ENUMS.DISEASE), 10);
    if (_textArray[_textArray.indexOf(PLAN_ENUMS.DISEASE) + 1] === PLAN_ENUMS.YES) {
      CSData.basicInfo.customer.disease = _textArray[_textArray.indexOf(PLAN_ENUMS.DISEASE) + 2].slice(6);
    } else {
      CSData.basicInfo.customer.disease = null;
    }
    // 申請服務種類
    for (let i = 1; i < 17; i++) {
      if (_textArray[_textArray.indexOf(PLAN_ENUMS.SERVICE_ITEM) + i].search(PLAN_ENUMS.CHECK_BOX) > 0) {
        CSData.basicInfo.customer.serviceItem.push(_textArray[_textArray.indexOf(PLAN_ENUMS.SERVICE_ITEM) + i].split(']')[1]);
      }
    }
    CSData.basicInfo.customer.serviceItem.sort();

    let handicap = getTextByKeyword(PLAN_ENUMS.HANDICAP, PLAN_ENUMS.AGE);
    handicap = (handicap === PLAN_ENUMS.AGE) ? null : handicap;
    if (!handicap) {
      handicap = getTextByKeyword(PLAN_ENUMS.HANDICAP_LEVEL, PLAN_ENUMS.VALID_DATE);
    }
    // 擷取障礙等級
    if (handicap) {
      [, handicap] = handicap.split('.');
    }
    CSData.basicInfo.handicapLevel = handicap;

    if (getTextByKeyword(PLAN_ENUMS.DISABILITY_PROVE, PLAN_ENUMS.NONE)) {
      CSData.basicInfo.disability.prove = getTextByKeyword(PLAN_ENUMS.DISABILITY_PROVE, PLAN_ENUMS.ICD);
      const bodySituation = _textArray[_textArray.indexOf(PLAN_ENUMS.BARRIER_CATEGORY_DESCRIPTION) + 1];
      // 判斷是否為新制
      if (bodySituation.indexOf(`(${PLAN_ENUMS.NEW_SYSTEM}`) !== -1) {
        CSData.basicInfo.disability.system = PLAN_ENUMS.NEW_SYSTEM;
        // 判斷是否為多重障礙
        if (bodySituation.indexOf(PLAN_ENUMS.MULTIPLE_OBSTACLES) !== -1) {
          // 如為新制多重障礙，且為填寫內容時的判斷
          if (_textArray[_textArray.indexOf(PLAN_ENUMS.BARRIER_CATEGORY_DESCRIPTION) + 2] === PLAN_ENUMS.HANDICAP_LEVEL) {
            const multiSituation = [];
            for (let i = _textArray.indexOf(PLAN_ENUMS.BARRIER_CATEGORY_NEW) + 1; i < _textArray.indexOf(PLAN_ENUMS.BARRIER_CATEGORY_OLD); i++) {
              const content = _textArray[i];
              if (/^\[\/lcms\/images\/icons\/checkbox_checked.gif\]/.test(content)) {
                if (/\d/.test(content)) {
                  multiSituation.push(`${PLAN_ENUMS.ICF}${content.match(/\d/)[0]}${PLAN_ENUMS.CATEGORY}`);
                }
              }
            }
            CSData.basicInfo.disability.note = multiSituation.length > 0 ? multiSituation : PLAN_ENUMS.MULTIPLE_OBSTACLES;
          } else {
            let multiSituation = '';
            if (_textArray[_textArray.indexOf(PLAN_ENUMS.BARRIER_CATEGORY_DESCRIPTION) + 2]) {
              multiSituation = _textArray[_textArray.indexOf(PLAN_ENUMS.BARRIER_CATEGORY_DESCRIPTION) + 2];
            } else {
              multiSituation = _textArray[_textArray.indexOf(PLAN_ENUMS.BARRIER_CATEGORY_DESCRIPTION) + 3];
            }
            // 文字為 ICF類
            if (multiSituation.indexOf(PLAN_ENUMS.ICF) !== -1) {
              CSData.basicInfo.disability.note = multiSituation.split('、');
            } else {
              CSData.basicInfo.disability.note = multiSituation.split(',');
            }
          }
        } else {
          CSData.basicInfo.disability.note = [bodySituation];
        }
      } else {
        CSData.basicInfo.disability.system = PLAN_ENUMS.OLD_SYSTEM;
        CSData.basicInfo.disability.oldBodySituation = getTextByKeyword(PLAN_ENUMS.BARRIER_CATEGORY_DESCRIPTION, PLAN_ENUMS.HANDICAP_LEVEL);
      }
      CSData.basicInfo.disability.level = getTextByKeyword(PLAN_ENUMS.BARRIER_CATEGORY_DESCRIPTION, PLAN_ENUMS.APPRAISAL_DATE) || PLAN_ENUMS.NORMAL;
    } else {
      CSData.basicInfo.disability.prove = PLAN_ENUMS.NONE;
      CSData.basicInfo.disability.note = PLAN_ENUMS.NONE;
      CSData.basicInfo.disability.level = PLAN_ENUMS.NORMAL;
      CSData.basicInfo.disability.system = PLAN_ENUMS.NEW_SYSTEM;
    }

    CSData.basicInfo.mentionHandicap = getTextByKeyword(PLAN_ENUMS.MENTAL_DISORDER, PLAN_ENUMS.BA12_USE);
    CSData.basicInfo.agent.name = getTextByKeyword(PLAN_ENUMS.AGENT_NAME, PLAN_ENUMS.AGENT_PERSONAL_ID);
    CSData.basicInfo.agent.personalId = getTextByKeyword(PLAN_ENUMS.AGENT_PERSONAL_ID, PLAN_ENUMS.AGENT_PHONE_H);
    CSData.basicInfo.agent.phoneH = getTextByKeyword(PLAN_ENUMS.AGENT_PHONE_H, PLAN_ENUMS.AGENT_PHONE_O);
    CSData.basicInfo.agent.phoneO = getTextByKeyword(PLAN_ENUMS.AGENT_PHONE_O, PLAN_ENUMS.AGENT_MOBILE);
    CSData.basicInfo.agent.phoneC = getTextByKeyword(PLAN_ENUMS.AGENT_MOBILE, PLAN_ENUMS.AGENT_RELATION);
    CSData.basicInfo.agent.relation = getTextByKeyword(PLAN_ENUMS.AGENT_RELATION, PLAN_ENUMS.OTHER_RELATION_DESCRIPTION);
    CSData.basicInfo.agent.relationNote = getTextByKeyword(PLAN_ENUMS.AGENT_RELATION, PLAN_ENUMS.AGENT_EMAIL, 3);
    CSData.basicInfo.agent.email = getTextByKeyword(PLAN_ENUMS.AGENT_EMAIL, PLAN_ENUMS.AGENT_ADDRESS);
    const agentAddress = _textArray[_textArray.indexOf(PLAN_ENUMS.AGENT_ADDRESS) + 1]
      + (_textArray[_textArray.indexOf(PLAN_ENUMS.AGENT_ADDRESS) + 2] !== '' ? _textArray[_textArray.indexOf(PLAN_ENUMS.AGENT_ADDRESS) + 2] : '');
    CSData.basicInfo.agent.address = agentAddress;

    CSData.basicInfo.contact.name = getTextByKeyword(PLAN_ENUMS.CONTACT_NAME, PLAN_ENUMS.CONTACT_PHONE_H);
    CSData.basicInfo.contact.phoneH = getTextByKeyword(PLAN_ENUMS.CONTACT_PHONE_H, PLAN_ENUMS.CONTACT_PHONE_O);
    CSData.basicInfo.contact.phoneO = getTextByKeyword(PLAN_ENUMS.CONTACT_PHONE_O, PLAN_ENUMS.CONTACT_MOBILE);
    CSData.basicInfo.contact.phoneC = getTextByKeyword(PLAN_ENUMS.CONTACT_MOBILE, PLAN_ENUMS.CONTACT_RELATION);
    CSData.basicInfo.contact.relation = getTextByKeyword(PLAN_ENUMS.CONTACT_RELATION, PLAN_ENUMS.OTHER_RELATION_DESCRIPTION);
    CSData.basicInfo.contact.relationNote = getTextByKeyword(PLAN_ENUMS.CONTACT_RELATION, PLAN_ENUMS.CONTACT_EMAIL, 3);
    CSData.basicInfo.contact.email = getTextByKeyword(PLAN_ENUMS.CONTACT_EMAIL, PLAN_ENUMS.CONTACT_ADDRESS);
    const contactAddress = _textArray[_textArray.indexOf(PLAN_ENUMS.CONTACT_ADDRESS) + 1]
      + (_textArray[_textArray.indexOf(PLAN_ENUMS.CONTACT_ADDRESS) + 2] !== '' ? _textArray[_textArray.indexOf(PLAN_ENUMS.CONTACT_ADDRESS) + 2] : '');
    CSData.basicInfo.contact.address = contactAddress;

    // 教育程度
    CSData.basicInfo.education = getTextByKeyword(PLAN_ENUMS.EDUCATION, PLAN_ENUMS.CASE_LEVEL);

    CSData.takeCarePlan.planType = getTextByKeyword(PLAN_ENUMS.PLAN_CATEGORY, PLAN_ENUMS.LONG_CARE_STATUS);
    CSData.takeCarePlan.writeOff = getTextByKeyword(PLAN_ENUMS.WRITE_OFF, PLAN_ENUMS.EVALUATE_DATE);
    CSData.takeCarePlan.evaluateDate = getTextByKeyword(PLAN_ENUMS.EVALUATE_DATE, `${PLAN_ENUMS.IS_DISABILITY_PROVE})`);
    CSData.takeCarePlan.disabilityProve = getTextByKeyword(`${PLAN_ENUMS.IS_DISABILITY_PROVE})`, PLAN_ENUMS.DISCHARGE_EVALUATE);

    // 是否有A個管服務
    if (_textArray[_textArray.indexOf(`${PLAN_ENUMS.A_CARE_TAKER_SERVICE}`) + 1]) {
      CSData.takeCarePlan.isACareTaker = true;
    }

    // CMS等級
    if ((_textArray.indexOf(PLAN_ENUMS.CMS_LEVEL) !== -1) && (_textArray[_textArray.indexOf(PLAN_ENUMS.CMS_LEVEL) - 1].search(PLAN_ENUMS.CHECK_BOX) > 0)) {
      CSData.takeCarePlan.bundledActive = PLAN_ENUMS.ENABLE;
    } else {
      CSData.takeCarePlan.bundledActive = PLAN_ENUMS.NON_ENABLE;
    }
    // 107新制
    while (_textArray.indexOf(PLAN_ENUMS.CARE_PROFESSIONAL_SERVICE) !== -1) {
      const bundledIndex = _textArray.indexOf(PLAN_ENUMS.CARE_PROFESSIONAL_SERVICE);
      let cms = '';
      for (let index = 1; index < 10; index++) {
        if (/^第\d{1}級/.test(_textArray[bundledIndex - index])) {
          cms = _textArray[bundledIndex - index];
          break;
        }
      }
      if (!cms) {
        _textArray.splice(bundledIndex, 1);
      } else {
        CSData.takeCarePlan.CMSLevel = cms;
        const bundledText = _textArray[bundledIndex + 3];
        CSData.takeCarePlan.bundled.quota = parseInt(StringUtil.getMatchText(bundledText, /\d+/g), 10);
        CSData.takeCarePlan.bundled.allowance = parseInt(StringUtil.getMatchText(bundledText, /\d+/g, 1), 10);
        CSData.takeCarePlan.bundled.pays = parseInt(StringUtil.getMatchText(bundledText, /\d+/g, 3), 10);
        CSData.takeCarePlan.bundled.priceType = getTextByKeyword(PLAN_ENUMS.PRICE_CATEGORY, PLAN_ENUMS.ALLOWANCE);
        CSData.takeCarePlan.bundled.workerCare = getTextByKeyword(PLAN_ENUMS.ALLOWANCE, PLAN_ENUMS.INTERFACE_NOTE);
        break;
      }
    }
    for (let index = _textArray.indexOf(PLAN_ENUMS.RESPITE_SERVICE); index !== -1; index = _textArray.indexOf(PLAN_ENUMS.RESPITE_SERVICE)) {
      if (!/^給付額度/.test(_textArray[index + 3])) {
        _textArray.splice(index, 1);
      } else {
        const bundledGText = _textArray[index + 3];
        CSData.takeCarePlan.bundledG.quota = parseInt(StringUtil.getMatchText(bundledGText, /\d+/g), 10);
        CSData.takeCarePlan.bundledG.allowance = parseInt(StringUtil.getMatchText(_textArray[index + 4], /\d+/g), 10);
        CSData.takeCarePlan.bundledG.pays = parseInt(StringUtil.getMatchText(_textArray[index + 4], /\d+/g, 2), 10);
        break;
      }
    }

    if (getTextByKeyword(PLAN_ENUMS.SIGN_SUPERVISOR_ONE, PLAN_ENUMS.APPROVAL_STATUS, 3)) {
      // 如有填寫狀態時
      let date = null;
      const status = getTextByKeyword(PLAN_ENUMS.SIGN_SUPERVISOR_ONE, PLAN_ENUMS.APPROVAL_DATE, 5);
      if (status) {
        let signTimeStr = getTextByKeyword(PLAN_ENUMS.SIGN_SUPERVISOR_ONE, PLAN_ENUMS.APPROVAL_CONTENT, 7);
        if (signTimeStr) {
          signTimeStr = signTimeStr.split('/');
          date = moment(`${parseInt(signTimeStr[0], 10) + 1911}-${signTimeStr[1]}-${signTimeStr[2]}`, dateFormat).toDate();
        }
      }
      CSData.takeCarePlan.signSupervisor.push({
        name: getTextByKeyword(PLAN_ENUMS.SIGN_SUPERVISOR_ONE, PLAN_ENUMS.APPROVAL_STATUS, 3),
        status,
        date,
      });
      if (getTextByKeyword(PLAN_ENUMS.SIGN_SUPERVISOR_TWO, PLAN_ENUMS.APPROVAL_STATUS, 2)) {
        // 如有填寫狀態時
        let statusDate = null;
        const signStatus = getTextByKeyword(PLAN_ENUMS.SIGN_SUPERVISOR_TWO, PLAN_ENUMS.APPROVAL_DATE, 4);
        if (signStatus) {
          let signTimeStr = getTextByKeyword(PLAN_ENUMS.SIGN_SUPERVISOR_TWO, PLAN_ENUMS.APPROVAL_CONTENT, 6);
          if (signTimeStr) {
            signTimeStr = signTimeStr.split('/');
            statusDate = moment(`${parseInt(signTimeStr[0], 10) + 1911}-${signTimeStr[1]}-${signTimeStr[2]}`, dateFormat).toDate();
          }
        }
        CSData.takeCarePlan.signSupervisor.push({
          name: getTextByKeyword(PLAN_ENUMS.SIGN_SUPERVISOR_TWO, PLAN_ENUMS.APPROVAL_STATUS, 2),
          signStatus,
          statusDate,
        });
      }
    }

    CSData.evaluation.helper.primaryName = getTextByKeyword(PLAN_ENUMS.HELPER_PRIMARY_NAME, PLAN_ENUMS.HELPER_PRIMARY_RELATION);
    CSData.evaluation.helper.primaryRelation = StringUtil.getMatchText(_textArray[_textArray.indexOf(PLAN_ENUMS.HELPER_PRIMARY_RELATION) + 1], /[^.]\D$/g);
    CSData.evaluation.helper.primaryGender = StringUtil.getMatchText(_textArray[_textArray.indexOf(PLAN_ENUMS.HELPER_PRIMARY_GENDER) + 1], /\D$/g);
    CSData.evaluation.helper.primaryAge = parseInt(StringUtil.getMatchText(_textArray[_textArray.indexOf(PLAN_ENUMS.HELPER_PRIMARY_AGE) + 1], /\d+/g), 10);
    const secondaryName = getTextByKeyword(PLAN_ENUMS.HELPER_SECONDARY_NAME, PLAN_ENUMS.HELPER_SECONDARY_RELATION);
    if (secondaryName !== PLAN_ENUMS.HELPER_SECONDARY_RELATION && secondaryName !== PLAN_ENUMS.NONE) {
      CSData.evaluation.helper.secondaryName = secondaryName;
      CSData.evaluation.helper.secondaryRelation = StringUtil.getMatchText(_textArray[_textArray.indexOf(PLAN_ENUMS.HELPER_SECONDARY_RELATION) + 1], /[^.]\D$/);
    }
    // 情緒及行為型態
    if (_textArray[_textArray.indexOf(PLAN_ENUMS.LANGUAGE_ATTACK) + 1].indexOf(PLAN_ENUMS.HAPPENED) !== -1) {
      CSData.basicInfo.behavior += `${PLAN_ENUMS.LANGUAGE_ATTACK},`;
    }
    if (_textArray[_textArray.indexOf(PLAN_ENUMS.PHYSICAL_ATTACK) + 1].indexOf(PLAN_ENUMS.HAPPENED) !== -1) {
      CSData.basicInfo.behavior += `${PLAN_ENUMS.PHYSICAL_ATTACK},`;
    }
    if (_textArray[_textArray.indexOf(PLAN_ENUMS.RESIST_CARE) + 1].indexOf(PLAN_ENUMS.HAPPENED) !== -1) {
      CSData.basicInfo.behavior += `${PLAN_ENUMS.RESIST_CARE},`;
    }
    if (_textArray[_textArray.indexOf(PLAN_ENUMS.ITEM_ATTACK) + 1].indexOf(PLAN_ENUMS.HAPPENED) !== -1) {
      CSData.basicInfo.behavior += `${PLAN_ENUMS.ITEM_ATTACK},`;
    }

    // 疾病史 medicalHistory
    if (_textArray.indexOf(`${PLAN_ENUMS.LCM_IMAGE_ICON}${PLAN_ENUMS.DEMENTIA}`) !== -1) {
      CSData.basicInfo.medicalHistory += `${PLAN_ENUMS.DEMENTIA},`;
    }
    if (_textArray.indexOf(`${PLAN_ENUMS.LCM_IMAGE_ICON}${PLAN_ENUMS.MENTAL_ILLNESS}`) !== -1) {
      CSData.basicInfo.medicalHistory += `${PLAN_ENUMS.MENTAL_ILLNESS},`;
    }
    if (_textArray.indexOf(`${PLAN_ENUMS.LCM_IMAGE_ICON}${PLAN_ENUMS.AUTISM}`) !== -1) {
      CSData.basicInfo.medicalHistory += `${PLAN_ENUMS.AUTISM},`;
    }
    if (_textArray.indexOf(`${PLAN_ENUMS.LCM_IMAGE_ICON}${PLAN_ENUMS.LOW_INTELLEGENCE}`) !== -1) {
      CSData.basicInfo.medicalHistory += `${PLAN_ENUMS.LOW_INTELLEGENCE},`;
    }
    if (_textArray.indexOf(`${PLAN_ENUMS.LCM_IMAGE_ICON}${PLAN_ENUMS.CEREBRAL_PALSY}`) !== -1) {
      CSData.basicInfo.medicalHistory += `${PLAN_ENUMS.CEREBRAL_PALSY},`;
    }
    if (_textArray.indexOf(`${PLAN_ENUMS.LCM_IMAGE_ICON}${PLAN_ENUMS.SPINAL_CORD_INJURY}`) !== -1) {
      CSData.basicInfo.medicalHistory += `${PLAN_ENUMS.SPINAL_CORD_INJURY},`;
    }
    if (_textArray.indexOf(`${PLAN_ENUMS.LCM_IMAGE_ICON}${PLAN_ENUMS.INFECTIOUS_DISEASE}`) !== -1) {
      CSData.basicInfo.medicalHistory += `${PLAN_ENUMS.INFECTIOUS_DISEASE},`;
    }
    if (_textArray.indexOf(`${PLAN_ENUMS.LCM_IMAGE_ICON}${PLAN_ENUMS.RARE_DISEASE}`) !== -1) {
      CSData.basicInfo.medicalHistory += `${PLAN_ENUMS.RARE_DISEASE},`;
    }

    // 特殊註記(用來判斷AA06的註記)
    if (_textArray.indexOf(`${PLAN_ENUMS.LCM_IMAGE_ICON}${PLAN_ENUMS.WITH_TUBE}`) !== -1) {
      CSData.basicInfo.specialMark += `${PLAN_ENUMS.WITH_TUBE},`;
    }
    if (_textArray.indexOf(`${PLAN_ENUMS.LCM_IMAGE_ICON}${PLAN_ENUMS.MOVE_DIFFICULT}`) !== -1) {
      CSData.basicInfo.specialMark += `${PLAN_ENUMS.MOVE_DIFFICULT},`;
    }
    if (_textArray[_textArray.indexOf(PLAN_ENUMS.MOVEMENT) + 1] === PLAN_ENUMS.SIT_UP_ON_HIS_OWN) {
      CSData.basicInfo.specialMark += `${PLAN_ENUMS.SIT_UP_ON_HIS_OWN},`;
    }
    if (_textArray[_textArray.indexOf(PLAN_ENUMS.MOVEMENT) + 1] === PLAN_ENUMS.FULL_ASSISTANCE) {
      CSData.basicInfo.specialMark += `${PLAN_ENUMS.FULL_ASSISTANCE},`;
    }

    // 預設AA03, AA04 移除
    const endOfIndex = (_textArray.indexOf(PLAN_ENUMS.INTERFACE_NOTE) !== -1) ? _textArray.indexOf(PLAN_ENUMS.INTERFACE_NOTE) : _textArray.indexOf(PLAN_ENUMS.UPLOAD_PICTURE);
    for (let i = _textArray.indexOf(PLAN_ENUMS.MENTAL_DISORDER) + 2; i < endOfIndex; i++) {
      if (
        /^AA05/.test(_textArray[i])
        && _textArray[i + 1] === PLAN_ENUMS.CONFORM
      ) {
        CSData.takeCarePlan.bundledItem.push({
          item: PLAN_ENUMS.AA05,
          price: 200,
          amount: 31,
          total: 0,
          itemType: PLAN_ENUMS.ITEM_TYPE_A,
        });
      } else if (
        /^AA06/.test(_textArray[i])
        && _textArray[i + 1] === PLAN_ENUMS.CONFORM
      ) {
        CSData.takeCarePlan.bundledItem.push({
          item: PLAN_ENUMS.AA06,
          price: 200,
          amount: 31,
          total: 0,
          itemType: PLAN_ENUMS.ITEM_TYPE_A,
        });
      } else if (
        /^AA07/.test(_textArray[i])
        && _textArray[i + 1] === PLAN_ENUMS.CONFORM
      ) {
        CSData.takeCarePlan.bundledItem.push({
          item: PLAN_ENUMS.AA07,
          price: 760,
          amount: 12,
          total: 0,
          itemType: PLAN_ENUMS.ITEM_TYPE_A,
        });
      } else if (
        /^AA08/.test(_textArray[i])
      ) {
        CSData.takeCarePlan.itemAA08.B = /checkbox_checked/.test(_textArray[i + 3]);
        CSData.takeCarePlan.itemAA08.C = /checkbox_checked/.test(_textArray[i + 4]);
      } else if (
        /^AA09/.test(_textArray[i])
      ) {
        CSData.takeCarePlan.itemAA09.B = /checkbox_checked/.test(_textArray[i + 3]);
        CSData.takeCarePlan.itemAA09.C = /checkbox_checked/.test(_textArray[i + 4]);
        CSData.takeCarePlan.itemAA09.G = /checkbox_checked/.test(_textArray[i + 5]);
      }
    }
    CSData.takeCarePlan.itemAA06IncludeBA12 = /checkbox_checked/.test(_textArray[_textArray.indexOf(PLAN_ENUMS.BA12_USE) + 1]);

    // 預設AA08, AA09, AA10 移除

    let dataIndex = _textArray.indexOf(PLAN_ENUMS.E1);
    CSData.evaluation.ADLs.push({ title: _textArray[dataIndex], val: _textArray[dataIndex + 3], score: _textArray[dataIndex + 5] });
    dataIndex = _textArray.indexOf(PLAN_ENUMS.E2);
    CSData.evaluation.ADLs.push({ title: _textArray[dataIndex], val: _textArray[dataIndex + 1], score: _textArray[dataIndex + 3] });
    dataIndex = _textArray.indexOf(PLAN_ENUMS.E3);
    CSData.evaluation.ADLs.push({ title: _textArray[dataIndex], val: _textArray[dataIndex + 3], score: _textArray[dataIndex + 5] });
    dataIndex = _textArray.indexOf(PLAN_ENUMS.E4);
    CSData.evaluation.ADLs.push({ title: _textArray[dataIndex], val: _textArray[dataIndex + 3], score: _textArray[dataIndex + 5] });
    dataIndex = _textArray.indexOf(PLAN_ENUMS.E5);
    CSData.evaluation.ADLs.push({ title: _textArray[dataIndex], val: _textArray[dataIndex + 1], score: _textArray[dataIndex + 3] });
    dataIndex = _textArray.indexOf(PLAN_ENUMS.E6);
    CSData.evaluation.ADLs.push({ title: _textArray[dataIndex], val: _textArray[dataIndex + 1], score: _textArray[dataIndex + 3] });
    dataIndex = _textArray.indexOf(PLAN_ENUMS.E7);
    CSData.evaluation.ADLs.push({ title: _textArray[dataIndex], val: _textArray[dataIndex + 1], score: _textArray[dataIndex + 3] });
    dataIndex = _textArray.indexOf(PLAN_ENUMS.MOVEMENT);
    CSData.evaluation.ADLs.push({ title: _textArray[dataIndex], val: _textArray[dataIndex + 1], score: _textArray[_textArray.indexOf(PLAN_ENUMS.E9) - 2] });
    dataIndex = _textArray.indexOf(PLAN_ENUMS.E9);
    CSData.evaluation.ADLs.push({
      title: _textArray[dataIndex],
      val: _textArray[dataIndex + 1] + _textArray[dataIndex + 2] + _textArray[dataIndex + 3],
      score: _textArray[dataIndex + 5],
    });
    dataIndex = _textArray.indexOf(PLAN_ENUMS.E10);
    CSData.evaluation.ADLs.push({ title: _textArray[dataIndex], val: _textArray[dataIndex + 1], score: _textArray[dataIndex + 3] });
    dataIndex = _textArray.indexOf(PLAN_ENUMS.E11);
    if (dataIndex !== -1) {
      CSData.evaluation.ADLs.push({ title: _textArray[dataIndex], val: _textArray[_textArray.indexOf(PLAN_ENUMS.F) - 2], score: '' });
    }

    dataIndex = _textArray.indexOf(PLAN_ENUMS.F1);
    CSData.evaluation.IADLs.push({ title: _textArray[dataIndex], val: _textArray[dataIndex + 1] });
    dataIndex = _textArray.indexOf(PLAN_ENUMS.F2);
    CSData.evaluation.IADLs.push({ title: _textArray[dataIndex], val: _textArray[dataIndex + 1] });
    dataIndex = _textArray.indexOf(PLAN_ENUMS.F3);
    CSData.evaluation.IADLs.push({ title: _textArray[dataIndex], val: _textArray[dataIndex + 1] });
    dataIndex = _textArray.indexOf(PLAN_ENUMS.F4);
    CSData.evaluation.IADLs.push({ title: _textArray[dataIndex], val: _textArray[dataIndex + 1] });
    dataIndex = _textArray.indexOf(PLAN_ENUMS.F5);
    CSData.evaluation.IADLs.push({ title: _textArray[dataIndex], val: _textArray[dataIndex + 1] });
    dataIndex = _textArray.indexOf(PLAN_ENUMS.F6);
    CSData.evaluation.IADLs.push({ title: _textArray[dataIndex], val: _textArray[dataIndex + 1] });
    dataIndex = _textArray.indexOf(PLAN_ENUMS.F7);
    CSData.evaluation.IADLs.push({ title: _textArray[dataIndex], val: _textArray[dataIndex + 1] });
    dataIndex = _textArray.indexOf(PLAN_ENUMS.F8);
    CSData.evaluation.IADLs.push({ title: _textArray[dataIndex], val: _textArray[dataIndex + 1] });

    // 擷取出院準備醫院
    CSData.takeCarePlan.dischargeHospital = getTextByKeyword(PLAN_ENUMS.DISCHARGE_HOSPITAL, PLAN_ENUMS.NO_WILLMENT);

    return casePlanObject;
  }

  /**
   * 計算超額自費
   * @param {Array} importItems 匯入之服務項目
   * @param {Number} quota quota
   * @returns {Number} overdueFee
   */
  static calculateOverdueFee(importItems, quota) {
    let total = 0;
    try {
      quota = parseInt(quota, 10);
    } catch (e) {
      throw new Error(`Quota parse error - ${e}`);
    }

    const arr = importItems.filter(x => /^(B|C)/.test(x.serviceCode));
    arr.forEach((x) => {
      total += parseInt(x.amount, 10) * x.cost;
    });

    return (total > quota) ? total - quota : 0;
  }
}

module.exports = HTMLParser;
