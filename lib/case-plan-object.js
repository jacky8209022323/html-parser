const BaseEntity = require('./base-entity');

class CasePlanObject extends BaseEntity {
  constructor() {
    super();
    this.version = '';
    this.caseInfo = {
      basicInfo: {
        applicationDate: null,
        customer: {
          aboriginalRace: '',
          aboriginalIdentity: '',
          birthday: null,
          disease: '',
          employment: '',
          employmentIntention: '',
          foreign: false,
          gender: '',
          height: '',
          hireCare: '',
          hireCareNum: null,
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
      },
      takeCarePlan: {
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
          allowance: null,
          pays: null,
          priceType: '',
          quota: null,
          workerCare: '',
        },
        bundledG: {
          allowance: null,
          pays: null,
          quota: null,
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
      },
      evaluation:  {
        helper: {
          primaryAge: null,
          primaryGender: '',
          primaryName: '',
          primaryRelation: '',
          secondaryName: '',
          secondaryRelation: '',
        },
        ADLs: [],
        IADLs: [],
      },
    };
  }

  bindWith(data = {}) {
    super.bind(data, this);
    return this;
  }
}

module.exports = CasePlanObject;
