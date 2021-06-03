const BaseEntity = require('./base-entity');

class CasePlanObject extends BaseEntity {
  constructor() {
    super();
    this.basicInfo = {
      applicationDate: '',
      customer: {
        aboriginalIdentity: '',
        aboriginalRace: '',
        birthday: null,
        disease: '',
        employment: '',
        employmentIntention: '',
        foreign: false,
        gender: '',
        height: '',
        hireCare: '',
        hireCareNum: '',
        hospitalized: '',
        language: [],
        level: '',
        livingSituation: '',
        name: '',
        serviceItem: [],
        personalId: '',
        phone: '',
        registeredAddress_city: '',
        registeredAddress_neighborhood: '',
        registeredAddress_others: '',
        registeredAddress_region: '',
        registeredAddress_road: '',
        registeredAddress_village: '',
        serviceAddress_city: '',
        serviceAddress_neighborhood: '',
        serviceAddress_others: '',
        serviceAddress_region: '',
        serviceAddress_road: '',
        serviceAddress_village: '',
        livingPartner: [],
        weight: '',
      },
      disability: {
        level: '',
        note: [],
        prove: '',
        system: '',
      },
      agent: {
        name: '',
        personalId: '',
        address: '',
        email: '',
        phoneC: '',
        phoneH: '',
        phoneO: '',
        relation: '',
        relationNote: '',
      },
      contact: {
        address: '',
        email: '',
        name: '',
        phoneC: '',
        phoneH: '',
        phoneO: '',
        relation: '',
        relationNote: '',
      },
      caretaker: '',
      behavior: '',
      medicalHistory: '',
      education: '',
      eligibility: '',
      handicapLevel: '',
      handleTime: null,
      mentionHandicap: '',
      specialMark: '',
    };
    this.takeCarePlan = {
      Aintroduction: '',
      AExecution: '',
      AMemo: '',
      AContact: {
        unit: '',
        name: '',
        telephone: '',
        email: '',
      },
      APlanItem: [],
      CMSLevel: '',
      bundled: {
        allowance: '',
        pays: '',
        priceType: '',
        quota: '',
        workerCare: '',
      },
      bundledG: {
        allowance: '',
        pays: '',
        quota: '',
      },
      bundledItem: [],
      signSupervisor: [],
      contractVersion: '2.1',
      hasNewItem: false,
      disabilityProve: '',
      evaluateDate: '',
      introduction: '',
      itemAA06IncludeBA12: null,
      itemAA08: {
        B: false,
        C: false,
      },
      itemAA09: {
        B: false,
        C: false,
        G: false,
      },
      modifyReason: '',
      planType: '',
      theme: '',
      writeOff: '',
      isACareTaker: false,
      dischargeHospital: '',
      changeSummary: '',
      bundledActive: '',
    };
    this.evaluation = {
      helper: {
        primaryAge: '',
        primaryGender: '',
        primaryName: '',
        primaryRelation: '',
        secondaryName: '',
        secondaryRelation: '',
      },
      ADLs: [],
      IADLs: [],
    };
  }

  bindWith(data = {}) {
    super.bind(data, this);
    return this;
  }
}

module.exports = CasePlanObject;
