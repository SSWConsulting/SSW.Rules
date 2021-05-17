"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _react = _interopRequireDefault(require("react"));

var _mobileDropdownItemModule = require("./mobile-dropdown-item.module.css");

var MobileDropdownItem = function MobileDropdownItem(_ref) {
  var item = _ref.item,
      index = _ref.index;
  return /*#__PURE__*/_react.default.createElement(_react.default.Fragment, null, /*#__PURE__*/_react.default.createElement("li", {
    key: index,
    className: _mobileDropdownItemModule.level1
  }, /*#__PURE__*/_react.default.createElement("a", {
    href: item.navigateUrl ? item.navigateUrl : null,
    className: _mobileDropdownItemModule.ignore
  }, item.text)));
};

var _default = MobileDropdownItem;
exports.default = _default;