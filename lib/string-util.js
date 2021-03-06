const moment = require('moment');

const splitAddress = (address) => {
  address = address.replace(/\([^()]*\)/g, '');
  const city = /\D{2}?(縣|市)/.test(address) ? address.match(/\D{2}?(縣|市)/)[0] : '';
  address = address.substr(city.length);
  const region = /\D+?(鄉|鎮|市|區)/.test(address) ? address.match(/\D+?(鄉|鎮|市|區)/)[0] : '';
  address = address.substr(region.length);
  const village = /\D+?(村|里)/.test(address) ? address.match(/\D+?(村|里)/)[0] : '';
  address = address.substr(village.length);
  const neighborhood = /.+?(鄰)/.test(address) ? address.match(/.+?(鄰)/)[0] : '';
  address = address.substr(neighborhood.length);
  const road = /.+?(路|街|段)/.test(address) ? address.match(/.+?(路|街|段)/)[0] : '';
  address = address.substr(road.length);
  return {
    city,
    region,
    village,
    neighborhood,
    road,
    theRest: address,
  };
};

const getMatchText = (text, pattern, index = 0) => ((text && pattern && text.match(pattern) && text.match(pattern).length >= (index + 1))
  ? text.match(pattern)[index] : '');

const getDate = (ROCDate) => {
  if (typeof ROCDate !== 'string' || ROCDate.length <= 0) {
    return null;
  }
  if (!(/[0-9]{3}\/[0-9]{2}\/[0-9]{2}/.test(ROCDate))) {
    return null;
  }
  const dateStr = ROCDate.split('/');
  const ADDate = `${parseInt(dateStr[0], 10) + 1911}-${dateStr[1]}-${dateStr[2]}`;

  return moment(ADDate).isValid() ? ADDate : null;
};

exports.getMatchText = getMatchText;
exports.splitAddress = splitAddress;
exports.getDate = getDate;
