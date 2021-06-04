const fs = require('fs').promises;
const moment = require('moment');
const { fromString } = require('html-to-text');
const taiwanIdValidator = require('taiwan-id-validator2');
const { StringUtil, HTMLEnums, CasePlanObject } = require('./lib');

const PLAN_ENUMS = HTMLEnums.HTMLEnums;

const getImportHtmlData = (textArray, tag, nextTag, index = 1) => {
  let data = '';
  if (textArray.indexOf(tag) >= 0) {
    data = textArray[textArray.indexOf(tag) + index];
    data = (data === nextTag ? '' : data);
  }
  return data;
};

/**
 * 擷取html裡面服務項目
 * @param {Array} textArray
 * @param {String} tag
 * @param {String} nextTag
 * @param {String} regex
 * @param {Array} arrayObj
 * @returns {boolean|string} newItem
 */
const getHtmlServiceItem = (textArray, tag, nextTag, regex, arrayObj) => {
  let newItem = false;
  let serviceItemIndex = textArray.indexOf(tag);
  let whileCounter = 0;

  while ((textArray[serviceItemIndex + 1] !== PLAN_ENUMS.ITEM) && (textArray[serviceItemIndex + 2] !== PLAN_ENUMS.ITEM)) {
    whileCounter += 1;
    if (whileCounter > 1000) {
      return `${PLAN_ENUMS.ERROR_UPLOAD_FAILED_MSG}${tag}`;
    }
    textArray.splice(serviceItemIndex, 1);
    serviceItemIndex = textArray.indexOf(tag);
  }
  let serviceItemEndIndex = textArray.indexOf(nextTag);
  while ((textArray[serviceItemEndIndex + 1] !== PLAN_ENUMS.ITEM) && (textArray[serviceItemEndIndex + 2] !== PLAN_ENUMS.ITEM)) {
    whileCounter += 1;
    if (whileCounter > 1000) {
      return `${PLAN_ENUMS.ERROR_UPLOAD_FAILED_MSG}${tag}`;
    }
    textArray.splice(serviceItemEndIndex, 1);
    serviceItemEndIndex = textArray.indexOf(nextTag);
  }
  const indexArr = [];
  for (let i = serviceItemIndex + 1; i < serviceItemEndIndex; i++) {
    if (regex.test(textArray[i])) {
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
      if (/^\d+/.test(textArray[indexArr[i] + j])) {
        numArr.push(textArray[indexArr[i] + j].replace(PLAN_ENUMS.DOLLAR, ''));
      }
    }
    if (/(10712|BA05-|BA23|BA24|BA09a)/.test(textArray[indexArr[i]])) {
      newItem = true;
    }
    if (numArr.length > 1) {
      arrayObj.push({
        item: textArray[indexArr[i]],
        price: numArr.length > 0 ? numArr[0] : 0,
        amount: numArr.length > 1 ? numArr[1] : 0,
        total: numArr.length > 2 ? numArr[2] : 0,
        itemType: textArray[indexArr[i]].substr(0, 1),
        newItem: /(10712|BA05-|BA23|BA24|BA09a)/.test(textArray[indexArr[i]]),
      });
    }
  }
  return newItem;
};

const getAUnitServiceItem = (textArray, arrayObj) => {
  let serviceItemStartIndex = textArray.indexOf(PLAN_ENUMS.CASE_MGMT_TAKECARE_PLAN);
  if (serviceItemStartIndex > 0 && textArray[serviceItemStartIndex + 1].includes(PLAN_ENUMS.A_UNIT)
    && textArray[serviceItemStartIndex + 2] === PLAN_ENUMS.ITEM) {
    serviceItemStartIndex += 2;
  } else {
    serviceItemStartIndex = -1;
  }

  let serviceItemEndIndex = -1;
  serviceItemEndIndex = textArray.indexOf(PLAN_ENUMS.A_QUESTION_LIST);

  if (serviceItemStartIndex > 0 && serviceItemEndIndex > 0) {
    let numIndex = 1;
    let prevIndex = -1;
    let diffLength = 0;
    const columnLimit = [2, 3, 5];
    for (let i = serviceItemStartIndex + 1; i < serviceItemEndIndex; i++) {
      if (textArray[i] === numIndex.toString()) {
        if (numIndex === 1) {
          prevIndex = i;
          numIndex++;
          continue;
        }

        diffLength = (i - prevIndex);

        if (columnLimit.includes(diffLength)) {
          arrayObj.push({
            item: textArray[prevIndex + 1],
            name: diffLength === 5 ? textArray[prevIndex + 2] : '',
            unit: diffLength === 5 ? textArray[prevIndex + 3] : '',
            reason: diffLength >= 3 ? textArray[prevIndex + diffLength - 1] : '',
          });
          prevIndex = i;
          numIndex++;
        }
      }
    }
    if (numIndex > 1 && columnLimit.includes(diffLength)) {
      arrayObj.push({
        item: textArray[prevIndex + 1],
        name: diffLength === 5 ? textArray[prevIndex + 2] : '',
        unit: diffLength === 5 ? textArray[prevIndex + 3] : '',
        reason: diffLength >= 3 ? textArray[prevIndex + diffLength - 1] : '',
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
    let textArray = text.split(' ');
    const casePlanObject = new CasePlanObject();
    const CSData = casePlanObject.caseInfo;

    // 不符合長照資格，則回傳錯誤訊息
    if (!textArray.includes(PLAN_ENUMS.LONG_CARE_QUALIFICATION)) {
      throw new Error('此檔案格式無法支援');
    }
    // 不能上傳照會單，則回傳錯誤訊息
    if (textArray.includes(PLAN_ENUMS.NOTE) && textArray.indexOf(PLAN_ENUMS.NOTE) < 10) {
      throw new Error('此檔案格式無法支援 (請提供照顧管理評估量表，而非照會單)');
    }

    // 主旨、異動摘要 Index
    const changeSummaryIndex = textArray.indexOf(PLAN_ENUMS.THEME);
    CSData.takeCarePlan.changeSummary = '';
    // 計畫異動原因 Index
    const planChangeReasonIndex = textArray.indexOf(PLAN_ENUMS.PLAN_CHANGE_REASON);
    CSData.takeCarePlan.planChangeReason = '';
    // 計畫簡述 Index
    let planIntroductionIndex = textArray.indexOf(PLAN_ENUMS.PLAN_DESCRIPTION);

    if ((textArray[planIntroductionIndex + 1] === PLAN_ENUMS.THEME) || (textArray[planIntroductionIndex + 2] === PLAN_ENUMS.THEME)) {
      textArray.splice(planIntroductionIndex, 1);
    }
    planIntroductionIndex = textArray.indexOf(PLAN_ENUMS.PLAN_DESCRIPTION);
    CSData.takeCarePlan.introduction = '';
    // A單位計畫簡述 Index
    let aUnitPlanStartIndex = textArray.indexOf(PLAN_ENUMS.QUESTION);
    let aUnitPlanEndIndex = textArray.indexOf(PLAN_ENUMS.A_CONTACT);
    // A單位個管聯絡資訊 Index
    let aUnitContactStartIndex = aUnitPlanEndIndex;
    let aUnitContactEndIndex = textArray.indexOf(PLAN_ENUMS.CARE_PROFESSIONAL_SERVICE_MONTH);

    if (aUnitPlanStartIndex !== -1 && aUnitPlanEndIndex !== -1
      && textArray[aUnitPlanStartIndex + 1].includes(PLAN_ENUMS.A_UNIT)
      && textArray[aUnitPlanEndIndex + 1].includes(PLAN_ENUMS.A_UNIT)) {
      aUnitPlanStartIndex += 1;
      aUnitPlanEndIndex += 1;
    }
    if (aUnitContactStartIndex !== -1 && aUnitContactEndIndex !== -1
      && textArray[aUnitContactStartIndex + 1].includes(PLAN_ENUMS.A_UNIT)
      && textArray[aUnitContactEndIndex + 1].includes(PLAN_ENUMS.SEARCH_SERVICE_DETAIL)) {
      aUnitContactStartIndex += 1;
      aUnitContactEndIndex += 1;
    }

    // 主旨、異動摘要
    if (changeSummaryIndex !== -1) {
      const endIndex = planChangeReasonIndex !== -1 ? planChangeReasonIndex : planIntroductionIndex;
      for (let i = changeSummaryIndex + 1; i < endIndex; i++) {
        CSData.takeCarePlan.theme += textArray[i];
      }
    }

    // 計畫異動原因
    if (planChangeReasonIndex !== -1) {
      for (let i = planChangeReasonIndex + 1; i < planIntroductionIndex; i++) {
        CSData.takeCarePlan.modifyReason += textArray[i];
      }
    }

    // 計畫簡述
    if (planIntroductionIndex !== -1) {
      let endIndex = textArray.indexOf(PLAN_ENUMS.CASE_WISH);
      if (endIndex === -1) {
        endIndex = textArray.indexOf(PLAN_ENUMS.CARE_PLAN);
      }
      for (let i = planIntroductionIndex + 1; i < endIndex; i++) {
        CSData.takeCarePlan.introduction += textArray[i];
      }
    }

    // A單位計畫簡述
    if ((aUnitPlanStartIndex !== -1) && (aUnitPlanEndIndex !== -1)) {
      let introIndex = -1;
      let execIndex = -1;
      let memoIndex = -1;
      for (let i = aUnitPlanStartIndex + 1; i < aUnitPlanEndIndex; i++) {
        if (textArray[i] === PLAN_ENUMS.PLAN_DESTINATION) {
          introIndex = i;
        }
        if (textArray[i] === PLAN_ENUMS.PLAN_EXEC) {
          execIndex = i;
        }
        if (textArray[i] === PLAN_ENUMS.OTHER_NOTE) {
          memoIndex = i;
        }
      }
      if (introIndex > 0 && execIndex > 0) {
        for (let i = introIndex + 3; i < execIndex; i++) {
          CSData.takeCarePlan.Aintroduction += textArray[i];
        }
      }
      if (execIndex > 0 && memoIndex > 0) {
        for (let i = execIndex + 3; i < memoIndex; i++) {
          CSData.takeCarePlan.AExecution += textArray[i];
        }
      }
      if (memoIndex > 0 && aUnitPlanEndIndex > 0) {
        for (let i = memoIndex + 3; i < aUnitPlanEndIndex - 1; i++) {
          CSData.takeCarePlan.AMemo += textArray[i];
        }
      }
    }

    text = text.replace(/\r\n|\n/g, '');
    textArray = text.split(' ');
    // A單位個管聯絡資訊
    if ((aUnitContactStartIndex !== -1) && (aUnitContactEndIndex !== -1)) {
      for (let i = aUnitContactStartIndex + 1; i < aUnitContactEndIndex; i++) {
        if (textArray[i].includes(PLAN_ENUMS.A_UNIT_NAME) && textArray[i + 1] !== '') {
          CSData.takeCarePlan.AContact.unit = textArray[i + 1];
        }
        if (textArray[i].includes(PLAN_ENUMS.A_CARE_TAKER_NAME) && textArray[i + 1] !== '') {
          CSData.takeCarePlan.AContact.name = textArray[i + 1];
        }
        if (textArray[i].includes(PLAN_ENUMS.CONTACT_PHONE) && textArray[i + 1] !== '') {
          CSData.takeCarePlan.AContact.telephone = textArray[i + 1];
        }
        if (textArray[i].includes(PLAN_ENUMS.E_MAIL) && textArray[i + 1] !== '') {
          CSData.takeCarePlan.AContact.email = textArray[i + 1];
        }
      }
    }

    CSData.basicInfo.applicationDate = StringUtil.getDate(textArray[textArray.indexOf(PLAN_ENUMS.APPLICATION_DATE) + 1]);
    CSData.basicInfo.caretaker = textArray[textArray.indexOf(PLAN_ENUMS.UNDERTAKER) + 1];
    CSData.takeCarePlan.hasNewItem = getHtmlServiceItem(
      textArray,
      PLAN_ENUMS.CARE_PROFESSIONAL_SERVICE_MONTH,
      PLAN_ENUMS.TRANSPORTATION,
      /^(B|C)/,
      CSData.takeCarePlan.bundledItem
    );
    getHtmlServiceItem(textArray, PLAN_ENUMS.TRANSPORTATION, PLAN_ENUMS.ASSISTIVE_SERVICE, /^D/, CSData.takeCarePlan.bundledItem);
    getHtmlServiceItem(textArray, PLAN_ENUMS.ASSISTIVE_SERVICE, PLAN_ENUMS.RESPITE_SERVICE_YEAR, /^(E|F)/, CSData.takeCarePlan.bundledItem);
    getHtmlServiceItem(textArray, PLAN_ENUMS.RESPITE_SERVICE_YEAR, PLAN_ENUMS.OTHER, /^G/, CSData.takeCarePlan.bundledItem);

    // 個案管理照顧計畫項目
    getAUnitServiceItem(textArray, CSData.takeCarePlan.APlanItem);

    // HTML內未包含規定內容
    if (typeof CSData.takeCarePlan.hasNewItem === 'string') {
      throw new Error('個案匯入/更新失敗, HTML內未包含規定內容');
    }

    CSData.basicInfo.customer.name = textArray[textArray.indexOf(PLAN_ENUMS.NAME) + 2];
    // 檢查個案姓名是否為空
    if (!CSData.basicInfo.customer.name) {
      throw new Error('個案姓名為空');
    }
    const nameIndex = textArray.indexOf(PLAN_ENUMS.TRADITIONAL_NAME);
    if (nameIndex !== -1) {
      const origName = textArray[nameIndex + 2];
      if (origName !== '') {
        CSData.basicInfo.customer.name += `(${origName})`;
      }
    }
    CSData.basicInfo.customer.gender = textArray[textArray.indexOf(PLAN_ENUMS.GENDER) + 1];
    // 檢查個案性別是否為空
    if (!CSData.basicInfo.customer.gender) {
      throw new Error('個案性別為空');
    }
    CSData.basicInfo.customer.birthday = StringUtil.getDate(textArray[textArray.indexOf(PLAN_ENUMS.BIRTHDAY) + 1]);
    // 檢查個案生日日期格式是否正確
    if (!CSData.basicInfo.customer.birthday) {
      throw new Error('個案生日格式有誤');
    }
    CSData.basicInfo.customer.personalId = textArray[textArray.indexOf(PLAN_ENUMS.PERSONAL_ID) + 1];
    // 檢查身份證字號是否為空
    if (!CSData.basicInfo.customer.personalId) {
      throw new Error('個案身份證字號格式有誤');
    }
    // 檢查身份證字號是否為本國籍格式
    if (!taiwanIdValidator.isNationalIdentificationNumberValid(CSData.basicInfo.customer.personalId)) {
      throw new Error('個案身份證字號格式有誤');
    }

    const handleTimeStr = textArray[textArray.indexOf(PLAN_ENUMS.PROCESS_TIME) + 1].split('/');
    const handleTime = moment(`${parseInt(handleTimeStr[0], 10) + 1911}-${handleTimeStr[1]}-${handleTimeStr[2]}`, dateFormat).toDate();
    CSData.basicInfo.handleTime = handleTime;
    CSData.basicInfo.eligibility = textArray[textArray.indexOf(PLAN_ENUMS.LONG_CARE_QUALIFICATION) + 1];
    const foreign = textArray[textArray.indexOf(PLAN_ENUMS.PERSONAL_ID) + 2];
    if (/外籍/.test(foreign) && /checkbox_checked/.test(foreign)) {
      CSData.basicInfo.customer.foreign = true;
    }
    CSData.basicInfo.customer.phone = '';
    for (let i = textArray.indexOf(PLAN_ENUMS.PHONE) + 1; i < textArray.indexOf(PLAN_ENUMS.NAME); i++) {
      CSData.basicInfo.customer.phone += textArray[i] || '';
    }
    if (textArray[textArray.indexOf(PLAN_ENUMS.ABORIGINAL_IDENTITY) + 1] !== PLAN_ENUMS.NO) {
      CSData.basicInfo.customer.aboriginalIdentity = textArray[textArray.indexOf(PLAN_ENUMS.ABORIGINAL_IDENTITY) + 1];
    }
    if (textArray[textArray.indexOf(PLAN_ENUMS.ABORIGINAL_RACE) + 1] !== '') {
      CSData.basicInfo.customer.aboriginalRace = textArray[textArray.indexOf(PLAN_ENUMS.ABORIGINAL_RACE) + 1];
    }
    const bmiIndex = textArray.indexOf(PLAN_ENUMS.BMI);
    const bmi = textArray[bmiIndex + 1];
    const bmi2 = textArray[bmiIndex + 2];
    const weight1 = bmi.match(/[0-9.]+公斤/) ? bmi.match(/[0-9.]+公斤/)[0] : '';
    const weight2 = bmi2.match(/[0-9.]+公斤/) ? bmi2.match(/[0-9.]+公斤/)[0] : '';
    CSData.basicInfo.customer.height = /[0-9.]+公分/.test(bmi) ? bmi.match(/[0-9.]+公分/)[0] : '';
    CSData.basicInfo.customer.weight = weight1 || weight2;
    CSData.basicInfo.customer.livingSituation = StringUtil.getMatchText(textArray[textArray.indexOf(PLAN_ENUMS.LIVING_SITUATION_Q) + 1], /[^0-9.]+/g);
    if (CSData.basicInfo.customer.livingSituation === `【${PLAN_ENUMS.SKIP_ANSWER}`) {
      CSData.basicInfo.customer.livingSituation = null;
    }
    if (!CSData.basicInfo.customer.livingSituation) {
      CSData.basicInfo.customer.livingSituation = textArray[textArray.indexOf(PLAN_ENUMS.LIVING_SITUATION) + 1];
    }
    const livePartnerIdx = textArray.indexOf(PLAN_ENUMS.LIVING_PARTNER_Q);
    if (livePartnerIdx > 0) {
      const livePartner = textArray[livePartnerIdx + 1].split(`${PLAN_ENUMS.CHECK_GIF}]`);
      for (let i = 1; i < livePartner.length; i++) {
        const from = livePartner[i].indexOf('.') + 1;
        const to = livePartner[i].indexOf('[');
        CSData.basicInfo.customer.livingPartner.push(livePartner[i].substr(from, to - from));
      }
    }

    // 戶籍地址
    const registerAddressIndex = textArray.indexOf(PLAN_ENUMS.REGISTERED_ADDRESS);
    const serviceAddressIndex = textArray.indexOf(PLAN_ENUMS.SERVICE_ADDRESS);
    const languageIndex = textArray.indexOf(PLAN_ENUMS.LANGUAGE);
    let registerAddress = textArray.slice(registerAddressIndex + 3, serviceAddressIndex).join('');

    registerAddress = StringUtil.splitAddress(registerAddress);
    CSData.basicInfo.customer.registeredAddress_city = registerAddress.city.replace('台', '臺');
    CSData.basicInfo.customer.registeredAddress_region = registerAddress.region.replace('台', '臺');
    CSData.basicInfo.customer.registeredAddress_village = registerAddress.village.replace('台', '臺');
    CSData.basicInfo.customer.registeredAddress_neighborhood = registerAddress.neighborhood;
    CSData.basicInfo.customer.registeredAddress_road = registerAddress.road;
    CSData.basicInfo.customer.registeredAddress_others = registerAddress.theRest;

    // 居住(通訊)地址
    let serviceAddress = textArray.slice(serviceAddressIndex + 3, languageIndex).join('');

    serviceAddress = StringUtil.splitAddress(serviceAddress);
    CSData.basicInfo.customer.serviceAddress_city = serviceAddress.city.replace('台', '臺');
    CSData.basicInfo.customer.serviceAddress_region = serviceAddress.region.replace('台', '臺');
    CSData.basicInfo.customer.serviceAddress_village = serviceAddress.village.replace('台', '臺');
    CSData.basicInfo.customer.serviceAddress_neighborhood = serviceAddress.neighborhood;
    CSData.basicInfo.customer.serviceAddress_road = serviceAddress.road;
    CSData.basicInfo.customer.serviceAddress_others = serviceAddress.theRest;
    for (let i = 1; i < 6; i++) {
      if (textArray[textArray.indexOf(PLAN_ENUMS.LANGUAGE) + i].search(PLAN_ENUMS.CHECK_BOX) > 0) {
        CSData.basicInfo.customer.language.push(textArray[textArray.indexOf(PLAN_ENUMS.LANGUAGE) + i].split(']')[1]);
      }
    }

    let customerLevel = '';
    let planUpdateCustomerLevel = '';
    while (textArray.indexOf(PLAN_ENUMS.LONG_CARE_STATUS) !== -1) {
      // 如照顧計畫區塊有更新的福利身份, 則以此為主
      if (textArray[textArray.indexOf(PLAN_ENUMS.LONG_CARE_STATUS) - 3] === PLAN_ENUMS.PLAN_CATEGORY) {
        planUpdateCustomerLevel = textArray[textArray.indexOf(PLAN_ENUMS.LONG_CARE_STATUS) + 1];
      } else {
        customerLevel = textArray[textArray.indexOf(PLAN_ENUMS.LONG_CARE_STATUS) + 1];
      }
      textArray.splice(textArray.indexOf(PLAN_ENUMS.LONG_CARE_STATUS), 1);
    }
    if (!customerLevel) {
      customerLevel = textArray[textArray.indexOf(PLAN_ENUMS.LONG_CARE_LEVEL) + 1];
    }
    CSData.basicInfo.customer.level = planUpdateCustomerLevel || customerLevel;

    CSData.basicInfo.customer.employment = getImportHtmlData(textArray, PLAN_ENUMS.EMPLOYMENT, PLAN_ENUMS.EMPLOYMENT_INTENTION);
    CSData.basicInfo.customer.employmentIntention = getImportHtmlData(textArray, PLAN_ENUMS.EMPLOYMENT_INTENTION, PLAN_ENUMS.CURRENT_LIVING_INSTITUTION);
    CSData.basicInfo.customer.hospitalized = textArray[textArray.indexOf(PLAN_ENUMS.HOSPITALIZED) + 1];
    CSData.basicInfo.customer.hireCare = textArray[textArray.indexOf(PLAN_ENUMS.HIRE_CARE) + 1];
    CSData.basicInfo.customer.hireCareNum = parseInt(textArray[textArray.indexOf(PLAN_ENUMS.HIRE_CARE_NUM) + 1], 10);
    if (textArray[textArray.indexOf(PLAN_ENUMS.DISEASE) + 1] === PLAN_ENUMS.YES) {
      CSData.basicInfo.customer.disease = textArray[textArray.indexOf(PLAN_ENUMS.DISEASE) + 2].slice(6);
    } else {
      CSData.basicInfo.customer.disease = null;
    }
    // 申請服務種類
    for (let i = 1; i < 17; i++) {
      if (textArray[textArray.indexOf(PLAN_ENUMS.SERVICE_ITEM) + i].search(PLAN_ENUMS.CHECK_BOX) > 0) {
        CSData.basicInfo.customer.serviceItem.push(textArray[textArray.indexOf(PLAN_ENUMS.SERVICE_ITEM) + i].split(']')[1]);
      }
    }
    CSData.basicInfo.customer.serviceItem.sort();

    let handicap = textArray[textArray.indexOf(PLAN_ENUMS.HANDICAP) + 1];
    handicap = (handicap === PLAN_ENUMS.AGE) ? null : handicap;
    if (!handicap) {
      handicap = getImportHtmlData(textArray, PLAN_ENUMS.HANDICAP_LEVEL, PLAN_ENUMS.VALID_DATE);
    }
    // 擷取障礙等級
    if (handicap) {
      [, handicap] = handicap.split('.');
    }
    CSData.basicInfo.handicapLevel = handicap;

    if (getImportHtmlData(textArray, PLAN_ENUMS.DISABILITY_PROVE, PLAN_ENUMS.NONE)) {
      CSData.basicInfo.disability.prove = textArray[textArray.indexOf(PLAN_ENUMS.DISABILITY_PROVE) + 1];
      const bodySituation = textArray[textArray.indexOf(PLAN_ENUMS.BARRIER_CATEGORY_DESCRIPTION) + 1];
      // 判斷是否為新制
      if (bodySituation.indexOf(`(${PLAN_ENUMS.NEW_SYSTEM}`) !== -1) {
        CSData.basicInfo.disability.system = PLAN_ENUMS.NEW_SYSTEM;
        // 判斷是否為多重障礙
        if (bodySituation.indexOf(PLAN_ENUMS.MULTIPLE_OBSTACLES) !== -1) {
          // 如為新制多重障礙，且為填寫內容時的判斷
          if (textArray[textArray.indexOf(PLAN_ENUMS.BARRIER_CATEGORY_DESCRIPTION) + 2] === PLAN_ENUMS.HANDICAP_LEVEL) {
            const multiSituation = [];
            for (let i = textArray.indexOf(PLAN_ENUMS.BARRIER_CATEGORY_NEW) + 1; i < textArray.indexOf(PLAN_ENUMS.BARRIER_CATEGORY_OLD); i++) {
              const content = textArray[i];
              if (/^\[\/lcms\/images\/icons\/checkbox_checked.gif\]/.test(content)) {
                if (/\d/.test(content)) {
                  multiSituation.push(`${PLAN_ENUMS.ICF}${content.match(/\d/)[0]}${PLAN_ENUMS.CATEGORY}`);
                }
              }
            }
            CSData.basicInfo.disability.note = multiSituation.length > 0 ? multiSituation : PLAN_ENUMS.MULTIPLE_OBSTACLES;
          } else {
            let multiSituation = '';
            if (textArray[textArray.indexOf(PLAN_ENUMS.BARRIER_CATEGORY_DESCRIPTION) + 2]) {
              multiSituation = textArray[textArray.indexOf(PLAN_ENUMS.BARRIER_CATEGORY_DESCRIPTION) + 2];
            } else {
              multiSituation = textArray[textArray.indexOf(PLAN_ENUMS.BARRIER_CATEGORY_DESCRIPTION) + 3];
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
        CSData.basicInfo.disability.oldBodySituation = getImportHtmlData(textArray, PLAN_ENUMS.BARRIER_CATEGORY_DESCRIPTION, PLAN_ENUMS.HANDICAP_LEVEL);
      }
      CSData.basicInfo.disability.level = getImportHtmlData(textArray, PLAN_ENUMS.BARRIER_CATEGORY_DESCRIPTION, PLAN_ENUMS.APPRAISAL_DATE) || PLAN_ENUMS.NORMAL;
    } else {
      CSData.basicInfo.disability.prove = PLAN_ENUMS.NONE;
      CSData.basicInfo.disability.note = PLAN_ENUMS.NONE;
      CSData.basicInfo.disability.level = PLAN_ENUMS.NORMAL;
      CSData.basicInfo.disability.system = PLAN_ENUMS.NEW_SYSTEM;
    }

    CSData.basicInfo.mentionHandicap = textArray[textArray.indexOf(PLAN_ENUMS.MENTAL_DISORDER) + 1];
    CSData.basicInfo.agent.name = getImportHtmlData(textArray, PLAN_ENUMS.AGENT_NAME, PLAN_ENUMS.AGENT_PERSONAL_ID);
    CSData.basicInfo.agent.personalId = getImportHtmlData(textArray, PLAN_ENUMS.AGENT_PERSONAL_ID, PLAN_ENUMS.AGENT_PHONE_H);
    CSData.basicInfo.agent.phoneH = getImportHtmlData(textArray, PLAN_ENUMS.AGENT_PHONE_H, PLAN_ENUMS.AGENT_PHONE_O);
    CSData.basicInfo.agent.phoneO = getImportHtmlData(textArray, PLAN_ENUMS.AGENT_PHONE_O, PLAN_ENUMS.AGENT_MOBILE);
    CSData.basicInfo.agent.phoneC = getImportHtmlData(textArray, PLAN_ENUMS.AGENT_MOBILE, PLAN_ENUMS.AGENT_RELATION);
    CSData.basicInfo.agent.relation = textArray[textArray.indexOf(PLAN_ENUMS.AGENT_RELATION) + 1];
    CSData.basicInfo.agent.relationNote = getImportHtmlData(textArray, PLAN_ENUMS.AGENT_RELATION, PLAN_ENUMS.AGENT_EMAIL, 3);
    CSData.basicInfo.agent.email = getImportHtmlData(textArray, PLAN_ENUMS.AGENT_EMAIL, PLAN_ENUMS.AGENT_ADDRESS);
    const agentAddress = textArray[textArray.indexOf(PLAN_ENUMS.AGENT_ADDRESS) + 1]
      + (textArray[textArray.indexOf(PLAN_ENUMS.AGENT_ADDRESS) + 2] !== '' ? textArray[textArray.indexOf(PLAN_ENUMS.AGENT_ADDRESS) + 2] : '');
    CSData.basicInfo.agent.address = agentAddress;

    CSData.basicInfo.contact.name = getImportHtmlData(textArray, PLAN_ENUMS.CONTACT_NAME, PLAN_ENUMS.CONTACT_PHONE_H);
    CSData.basicInfo.contact.phoneH = getImportHtmlData(textArray, PLAN_ENUMS.CONTACT_PHONE_H, PLAN_ENUMS.CONTACT_PHONE_O);
    CSData.basicInfo.contact.phoneO = getImportHtmlData(textArray, PLAN_ENUMS.CONTACT_PHONE_O, PLAN_ENUMS.CONTACT_MOBILE);
    CSData.basicInfo.contact.phoneC = getImportHtmlData(textArray, PLAN_ENUMS.CONTACT_MOBILE, PLAN_ENUMS.CONTACT_RELATION);
    CSData.basicInfo.contact.relation = textArray[textArray.indexOf(PLAN_ENUMS.CONTACT_RELATION) + 1];
    CSData.basicInfo.contact.relationNote = getImportHtmlData(textArray, PLAN_ENUMS.CONTACT_RELATION, PLAN_ENUMS.CONTACT_EMAIL, 3);
    CSData.basicInfo.contact.email = getImportHtmlData(textArray, PLAN_ENUMS.CONTACT_EMAIL, PLAN_ENUMS.CONTACT_ADDRESS);
    const contactAddress = textArray[textArray.indexOf(PLAN_ENUMS.CONTACT_ADDRESS) + 1]
      + (textArray[textArray.indexOf(PLAN_ENUMS.CONTACT_ADDRESS) + 2] !== '' ? textArray[textArray.indexOf(PLAN_ENUMS.CONTACT_ADDRESS) + 2] : '');
    CSData.basicInfo.contact.address = contactAddress;

    // 教育程度
    CSData.basicInfo.education = textArray[textArray.indexOf(PLAN_ENUMS.EDUCATION) + 1];

    CSData.takeCarePlan.planType = textArray[textArray.indexOf(PLAN_ENUMS.PLAN_CATEGORY) + 1];
    CSData.takeCarePlan.writeOff = textArray[textArray.indexOf(PLAN_ENUMS.WRITE_OFF) + 1];
    CSData.takeCarePlan.evaluateDate = textArray[textArray.indexOf(PLAN_ENUMS.EVALUATE_DATE) + 1];
    CSData.takeCarePlan.disabilityProve = textArray[textArray.indexOf(`${PLAN_ENUMS.IS_DISABILITY_PROVE})`) + 1];

    // 是否有A個管服務
    if (textArray[textArray.indexOf(`${PLAN_ENUMS.A_CARE_TAKER_SERVICE}`) + 1]) {
      CSData.takeCarePlan.isACareTaker = true;
    }

    // CMS等級
    if ((textArray.indexOf(PLAN_ENUMS.CMS_LEVEL) !== -1) && (textArray[textArray.indexOf(PLAN_ENUMS.CMS_LEVEL) - 1].search(PLAN_ENUMS.CHECK_BOX) > 0)) {
      CSData.takeCarePlan.bundledActive = PLAN_ENUMS.ENABLE;
    } else {
      CSData.takeCarePlan.bundledActive = PLAN_ENUMS.NON_ENABLE;
    }
    // 107新制
    while (textArray.indexOf(PLAN_ENUMS.CARE_PROFESSIONAL_SERVICE) !== -1) {
      const bundledIndex = textArray.indexOf(PLAN_ENUMS.CARE_PROFESSIONAL_SERVICE);
      let cms = '';
      for (let index = 1; index < 10; index++) {
        if (/^第\d{1}級/.test(textArray[bundledIndex - index])) {
          cms = textArray[bundledIndex - index];
          break;
        }
      }
      if (!cms) {
        textArray.splice(bundledIndex, 1);
      } else {
        CSData.takeCarePlan.CMSLevel = cms;
        const bundledText = textArray[bundledIndex + 3];
        CSData.takeCarePlan.bundled.quota = parseInt(StringUtil.getMatchText(bundledText, /\d+/g), 10);
        CSData.takeCarePlan.bundled.allowance = parseInt(StringUtil.getMatchText(bundledText, /\d+/g, 1), 10);
        CSData.takeCarePlan.bundled.pays = parseInt(StringUtil.getMatchText(bundledText, /\d+/g, 3), 10);
        CSData.takeCarePlan.bundled.priceType = textArray[textArray.indexOf(PLAN_ENUMS.PRICE_CATEGORY) + 1];
        CSData.takeCarePlan.bundled.workerCare = getImportHtmlData(textArray, PLAN_ENUMS.ALLOWANCE, PLAN_ENUMS.INTERFACE_NOTE);
        break;
      }
    }
    for (let index = textArray.indexOf(PLAN_ENUMS.RESPITE_SERVICE); index !== -1; index = textArray.indexOf(PLAN_ENUMS.RESPITE_SERVICE)) {
      if (!/^給付額度/.test(textArray[index + 3])) {
        textArray.splice(index, 1);
      } else {
        const bundledGText = textArray[index + 3];
        CSData.takeCarePlan.bundledG.quota = parseInt(StringUtil.getMatchText(bundledGText, /\d+/g), 10);
        CSData.takeCarePlan.bundledG.allowance = parseInt(StringUtil.getMatchText(textArray[index + 4], /\d+/g), 10);
        CSData.takeCarePlan.bundledG.pays = parseInt(StringUtil.getMatchText(textArray[index + 4], /\d+/g, 2), 10);
        break;
      }
    }

    if (getImportHtmlData(textArray, PLAN_ENUMS.SIGN_SUPERVISOR_ONE, PLAN_ENUMS.APPROVAL_STATUS, 3)) {
      // 如有填寫狀態時
      let date = null;
      const status = getImportHtmlData(textArray, PLAN_ENUMS.SIGN_SUPERVISOR_ONE, PLAN_ENUMS.APPROVAL_DATE, 5);
      if (status) {
        let signTimeStr = getImportHtmlData(textArray, PLAN_ENUMS.SIGN_SUPERVISOR_ONE, PLAN_ENUMS.APPROVAL_CONTENT, 7);
        if (signTimeStr) {
          signTimeStr = signTimeStr.split('/');
          date = moment(`${parseInt(signTimeStr[0], 10) + 1911}-${signTimeStr[1]}-${signTimeStr[2]}`, dateFormat).toDate();
        }
      }
      CSData.takeCarePlan.signSupervisor.push({
        name: getImportHtmlData(textArray, PLAN_ENUMS.SIGN_SUPERVISOR_ONE, PLAN_ENUMS.APPROVAL_STATUS, 3),
        status,
        date,
      });
      if (getImportHtmlData(textArray, PLAN_ENUMS.SIGN_SUPERVISOR_TWO, PLAN_ENUMS.APPROVAL_STATUS, 2)) {
        // 如有填寫狀態時
        let statusDate = null;
        const signStatus = getImportHtmlData(textArray, PLAN_ENUMS.SIGN_SUPERVISOR_TWO, PLAN_ENUMS.APPROVAL_DATE, 4);
        if (signStatus) {
          let signTimeStr = getImportHtmlData(textArray, PLAN_ENUMS.SIGN_SUPERVISOR_TWO, PLAN_ENUMS.APPROVAL_CONTENT, 6);
          if (signTimeStr) {
            signTimeStr = signTimeStr.split('/');
            statusDate = moment(`${parseInt(signTimeStr[0], 10) + 1911}-${signTimeStr[1]}-${signTimeStr[2]}`, dateFormat).toDate();
          }
        }
        CSData.takeCarePlan.signSupervisor.push({
          name: getImportHtmlData(textArray, PLAN_ENUMS.SIGN_SUPERVISOR_TWO, PLAN_ENUMS.APPROVAL_STATUS, 2),
          signStatus,
          statusDate,
        });
      }
    }

    CSData.evaluation.helper.primaryName = textArray[textArray.indexOf(PLAN_ENUMS.HELPER_PRIMARY_NAME) + 1];
    CSData.evaluation.helper.primaryRelation = StringUtil.getMatchText(textArray[textArray.indexOf(PLAN_ENUMS.HELPER_PRIMARY_RELATION) + 1], /[^.]\D$/g);
    CSData.evaluation.helper.primaryGender = StringUtil.getMatchText(textArray[textArray.indexOf(PLAN_ENUMS.HELPER_PRIMARY_GENDER) + 1], /\D$/g);
    CSData.evaluation.helper.primaryAge = parseInt(StringUtil.getMatchText(textArray[textArray.indexOf(PLAN_ENUMS.HELPER_PRIMARY_AGE) + 1], /\d+/g), 10);
    if (textArray[textArray.indexOf(PLAN_ENUMS.HELPER_SECONDARY_NAME) + 1] !== PLAN_ENUMS.HELPER_SECONDARY_RELATION
      && textArray[textArray.indexOf(PLAN_ENUMS.HELPER_SECONDARY_NAME) + 1] !== PLAN_ENUMS.NONE) {
      CSData.evaluation.helper.secondaryName = textArray[textArray.indexOf(PLAN_ENUMS.HELPER_SECONDARY_NAME) + 1];
      CSData.evaluation.helper.secondaryRelation = StringUtil.getMatchText(textArray[textArray.indexOf(PLAN_ENUMS.HELPER_SECONDARY_RELATION) + 1], /[^.]\D$/);
    }
    // 情緒及行為型態
    if (textArray[textArray.indexOf(PLAN_ENUMS.LANGUAGE_ATTACK) + 1].indexOf(PLAN_ENUMS.HAPPENED) !== -1) {
      CSData.basicInfo.behavior += `${PLAN_ENUMS.LANGUAGE_ATTACK},`;
    }
    if (textArray[textArray.indexOf(PLAN_ENUMS.PHYSICAL_ATTACK) + 1].indexOf(PLAN_ENUMS.HAPPENED) !== -1) {
      CSData.basicInfo.behavior += `${PLAN_ENUMS.PHYSICAL_ATTACK},`;
    }
    if (textArray[textArray.indexOf(PLAN_ENUMS.RESIST_CARE) + 1].indexOf(PLAN_ENUMS.HAPPENED) !== -1) {
      CSData.basicInfo.behavior += `${PLAN_ENUMS.RESIST_CARE},`;
    }
    if (textArray[textArray.indexOf(PLAN_ENUMS.ITEM_ATTACK) + 1].indexOf(PLAN_ENUMS.HAPPENED) !== -1) {
      CSData.basicInfo.behavior += `${PLAN_ENUMS.ITEM_ATTACK},`;
    }

    // 疾病史 medicalHistory
    if (textArray.indexOf(`${PLAN_ENUMS.LCM_IMAGE_ICON}${PLAN_ENUMS.DEMENTIA}`) !== -1) {
      CSData.basicInfo.medicalHistory += `${PLAN_ENUMS.DEMENTIA},`;
    }
    if (textArray.indexOf(`${PLAN_ENUMS.LCM_IMAGE_ICON}${PLAN_ENUMS.MENTAL_ILLNESS}`) !== -1) {
      CSData.basicInfo.medicalHistory += `${PLAN_ENUMS.MENTAL_ILLNESS},`;
    }
    if (textArray.indexOf(`${PLAN_ENUMS.LCM_IMAGE_ICON}${PLAN_ENUMS.AUTISM}`) !== -1) {
      CSData.basicInfo.medicalHistory += `${PLAN_ENUMS.AUTISM},`;
    }
    if (textArray.indexOf(`${PLAN_ENUMS.LCM_IMAGE_ICON}${PLAN_ENUMS.LOW_INTELLEGENCE}`) !== -1) {
      CSData.basicInfo.medicalHistory += `${PLAN_ENUMS.LOW_INTELLEGENCE},`;
    }
    if (textArray.indexOf(`${PLAN_ENUMS.LCM_IMAGE_ICON}${PLAN_ENUMS.CEREBRAL_PALSY}`) !== -1) {
      CSData.basicInfo.medicalHistory += `${PLAN_ENUMS.CEREBRAL_PALSY},`;
    }
    if (textArray.indexOf(`${PLAN_ENUMS.LCM_IMAGE_ICON}${PLAN_ENUMS.SPINAL_CORD_INJURY}`) !== -1) {
      CSData.basicInfo.medicalHistory += `${PLAN_ENUMS.SPINAL_CORD_INJURY},`;
    }
    if (textArray.indexOf(`${PLAN_ENUMS.LCM_IMAGE_ICON}${PLAN_ENUMS.INFECTIOUS_DISEASE}`) !== -1) {
      CSData.basicInfo.medicalHistory += `${PLAN_ENUMS.INFECTIOUS_DISEASE},`;
    }
    if (textArray.indexOf(`${PLAN_ENUMS.LCM_IMAGE_ICON}${PLAN_ENUMS.RARE_DISEASE}`) !== -1) {
      CSData.basicInfo.medicalHistory += `${PLAN_ENUMS.RARE_DISEASE},`;
    }

    // 特殊註記(用來判斷AA06的註記)
    if (textArray.indexOf(`${PLAN_ENUMS.LCM_IMAGE_ICON}${PLAN_ENUMS.WITH_TUBE}`) !== -1) {
      CSData.basicInfo.specialMark += `${PLAN_ENUMS.WITH_TUBE},`;
    }
    if (textArray.indexOf(`${PLAN_ENUMS.LCM_IMAGE_ICON}${PLAN_ENUMS.MOVE_DIFFICULT}`) !== -1) {
      CSData.basicInfo.specialMark += `${PLAN_ENUMS.MOVE_DIFFICULT},`;
    }
    if (textArray[textArray.indexOf(PLAN_ENUMS.MOVEMENT) + 1] === PLAN_ENUMS.SIT_UP_ON_HIS_OWN) {
      CSData.basicInfo.specialMark += `${PLAN_ENUMS.SIT_UP_ON_HIS_OWN},`;
    }
    if (textArray[textArray.indexOf(PLAN_ENUMS.MOVEMENT) + 1] === PLAN_ENUMS.FULL_ASSISTANCE) {
      CSData.basicInfo.specialMark += `${PLAN_ENUMS.FULL_ASSISTANCE},`;
    }

    // 預設AA03, AA04 移除
    const endOfIndex = (textArray.indexOf(PLAN_ENUMS.INTERFACE_NOTE) !== -1) ? textArray.indexOf(PLAN_ENUMS.INTERFACE_NOTE) : textArray.indexOf(PLAN_ENUMS.UPLOAD_PICTURE);
    for (let i = textArray.indexOf(PLAN_ENUMS.MENTAL_DISORDER) + 2; i < endOfIndex; i++) {
      if (
        /^AA05/.test(textArray[i])
        && textArray[i + 1] === PLAN_ENUMS.CONFORM
      ) {
        CSData.takeCarePlan.bundledItem.push({
          item: PLAN_ENUMS.AA05,
          price: 200,
          amount: 31,
          total: 0,
          itemType: PLAN_ENUMS.ITEM_TYPE_A,
        });
      } else if (
        /^AA06/.test(textArray[i])
        && textArray[i + 1] === PLAN_ENUMS.CONFORM
      ) {
        CSData.takeCarePlan.bundledItem.push({
          item: PLAN_ENUMS.AA06,
          price: 200,
          amount: 31,
          total: 0,
          itemType: PLAN_ENUMS.ITEM_TYPE_A,
        });
      } else if (
        /^AA07/.test(textArray[i])
        && textArray[i + 1] === PLAN_ENUMS.CONFORM
      ) {
        CSData.takeCarePlan.bundledItem.push({
          item: PLAN_ENUMS.AA07,
          price: 760,
          amount: 12,
          total: 0,
          itemType: PLAN_ENUMS.ITEM_TYPE_A,
        });
      } else if (
        /^AA08/.test(textArray[i])
      ) {
        CSData.takeCarePlan.itemAA08.B = /checkbox_checked/.test(textArray[i + 3]);
        CSData.takeCarePlan.itemAA08.C = /checkbox_checked/.test(textArray[i + 4]);
      } else if (
        /^AA09/.test(textArray[i])
      ) {
        CSData.takeCarePlan.itemAA09.B = /checkbox_checked/.test(textArray[i + 3]);
        CSData.takeCarePlan.itemAA09.C = /checkbox_checked/.test(textArray[i + 4]);
        CSData.takeCarePlan.itemAA09.G = /checkbox_checked/.test(textArray[i + 5]);
      }
    }
    CSData.takeCarePlan.itemAA06IncludeBA12 = /checkbox_checked/.test(textArray[textArray.indexOf(PLAN_ENUMS.BA12_USE) + 1]);

    // 預設AA08, AA09, AA10 移除

    let dataIndex = textArray.indexOf(PLAN_ENUMS.E1);
    CSData.evaluation.ADLs.push({ title: textArray[dataIndex], val: textArray[dataIndex + 3], score: textArray[dataIndex + 5] });
    dataIndex = textArray.indexOf(PLAN_ENUMS.E2);
    CSData.evaluation.ADLs.push({ title: textArray[dataIndex], val: textArray[dataIndex + 1], score: textArray[dataIndex + 3] });
    dataIndex = textArray.indexOf(PLAN_ENUMS.E3);
    CSData.evaluation.ADLs.push({ title: textArray[dataIndex], val: textArray[dataIndex + 3], score: textArray[dataIndex + 5] });
    dataIndex = textArray.indexOf(PLAN_ENUMS.E4);
    CSData.evaluation.ADLs.push({ title: textArray[dataIndex], val: textArray[dataIndex + 3], score: textArray[dataIndex + 5] });
    dataIndex = textArray.indexOf(PLAN_ENUMS.E5);
    CSData.evaluation.ADLs.push({ title: textArray[dataIndex], val: textArray[dataIndex + 1], score: textArray[dataIndex + 3] });
    dataIndex = textArray.indexOf(PLAN_ENUMS.E6);
    CSData.evaluation.ADLs.push({ title: textArray[dataIndex], val: textArray[dataIndex + 1], score: textArray[dataIndex + 3] });
    dataIndex = textArray.indexOf(PLAN_ENUMS.E7);
    CSData.evaluation.ADLs.push({ title: textArray[dataIndex], val: textArray[dataIndex + 1], score: textArray[dataIndex + 3] });
    dataIndex = textArray.indexOf(PLAN_ENUMS.MOVEMENT);
    CSData.evaluation.ADLs.push({ title: textArray[dataIndex], val: textArray[dataIndex + 1], score: textArray[textArray.indexOf(PLAN_ENUMS.E9) - 2] });
    dataIndex = textArray.indexOf(PLAN_ENUMS.E9);
    CSData.evaluation.ADLs.push({
      title: textArray[dataIndex],
      val: textArray[dataIndex + 1] + textArray[dataIndex + 2] + textArray[dataIndex + 3],
      score: textArray[dataIndex + 5],
    });
    dataIndex = textArray.indexOf(PLAN_ENUMS.E10);
    CSData.evaluation.ADLs.push({ title: textArray[dataIndex], val: textArray[dataIndex + 1], score: textArray[dataIndex + 3] });
    dataIndex = textArray.indexOf(PLAN_ENUMS.E11);
    if (dataIndex !== -1) {
      CSData.evaluation.ADLs.push({ title: textArray[dataIndex], val: textArray[textArray.indexOf(PLAN_ENUMS.F) - 2], score: '' });
    }

    dataIndex = textArray.indexOf(PLAN_ENUMS.F1);
    CSData.evaluation.IADLs.push({ title: textArray[dataIndex], val: textArray[dataIndex + 1] });
    dataIndex = textArray.indexOf(PLAN_ENUMS.F2);
    CSData.evaluation.IADLs.push({ title: textArray[dataIndex], val: textArray[dataIndex + 1] });
    dataIndex = textArray.indexOf(PLAN_ENUMS.F3);
    CSData.evaluation.IADLs.push({ title: textArray[dataIndex], val: textArray[dataIndex + 1] });
    dataIndex = textArray.indexOf(PLAN_ENUMS.F4);
    CSData.evaluation.IADLs.push({ title: textArray[dataIndex], val: textArray[dataIndex + 1] });
    dataIndex = textArray.indexOf(PLAN_ENUMS.F5);
    CSData.evaluation.IADLs.push({ title: textArray[dataIndex], val: textArray[dataIndex + 1] });
    dataIndex = textArray.indexOf(PLAN_ENUMS.F6);
    CSData.evaluation.IADLs.push({ title: textArray[dataIndex], val: textArray[dataIndex + 1] });
    dataIndex = textArray.indexOf(PLAN_ENUMS.F7);
    CSData.evaluation.IADLs.push({ title: textArray[dataIndex], val: textArray[dataIndex + 1] });
    dataIndex = textArray.indexOf(PLAN_ENUMS.F8);
    CSData.evaluation.IADLs.push({ title: textArray[dataIndex], val: textArray[dataIndex + 1] });

    // 擷取出院準備醫院
    const dischargeHospital = textArray[textArray.indexOf(PLAN_ENUMS.DISCHARGE_HOSPITAL) + 1];
    if (dischargeHospital !== PLAN_ENUMS.NO_WILLMENT) {
      CSData.takeCarePlan.dischargeHospital = dischargeHospital;
    }

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
