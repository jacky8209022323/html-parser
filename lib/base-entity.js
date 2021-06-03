/**
 * @class
 * @description Represents a base entity
 */
class BaseEntity {
  /**
   * @method
   * @description Binding incoming parameters to target object
   * @param {Object} source - Incoming request parameters
   * @param {Object} target - Target object to be binded
   * @returns {void} void
   */
  bind(source = {}, target = {}) {
    const sourceKeys = Object.keys(source);
    for (const k of sourceKeys) {
      // eslint-disable-next-line no-prototype-builtins
      if (target.hasOwnProperty(k)) {
        target[k] = source[k];
      }
    }
  }
}

module.exports = BaseEntity;
