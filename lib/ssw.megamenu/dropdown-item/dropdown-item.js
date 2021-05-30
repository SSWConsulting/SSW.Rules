"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _react = _interopRequireDefault(require("react"));

var _dropdownItemModule = require("./dropdown-item.module.css");

var _classnames = _interopRequireDefault(require("classnames"));

var DropdownItem = function DropdownItem(_ref) {
  var item = _ref.item,
      index = _ref.index;
  var styles = [_dropdownItemModule.NonClickableMenuItem, _dropdownItemModule.level1, _dropdownItemModule.level2, _dropdownItemModule.ignore, _dropdownItemModule.ClickableMenuItem];
  var l1Class = item.data.navigateUrlOnMobileOnly ? (0, _classnames.default)(_dropdownItemModule.NonClickableMenuItem, _dropdownItemModule.level1) : item.data.cssClass ? (0, _classnames.default)(styles[item.data.cssClass], _dropdownItemModule.level1) : _dropdownItemModule.level1;
  return /*#__PURE__*/_react.default.createElement(_react.default.Fragment, null, item.level === 1 && /*#__PURE__*/_react.default.createElement("li", {
    key: index,
    className: l1Class
  }, (!item.data.navigateUrl || item.data.navigateUrlOnMobileOnly) && /*#__PURE__*/_react.default.createElement("span", {
    className: (0, _classnames.default)(_dropdownItemModule.ignore, "unstyled")
  }, item.data.text), item.data.navigateUrl && !item.data.navigateUrlOnMobileOnly && /*#__PURE__*/_react.default.createElement("a", {
    href: item.data.navigateUrl ? item.data.navigateUrl : null,
    className: (0, _classnames.default)(_dropdownItemModule.ignore, "unstyled")
  }, item.data.text)), item.level === 2 && /*#__PURE__*/_react.default.createElement("li", {
    key: index,
    className: item.data.cssClass ? (0, _classnames.default)(styles[item.data.cssClass], _dropdownItemModule.ClickableMenuItem, _dropdownItemModule.level2) : (0, _classnames.default)(_dropdownItemModule.ClickableMenuItem, _dropdownItemModule.level2)
  }, /*#__PURE__*/_react.default.createElement("a", {
    href: item.data.navigateUrl ? item.data.navigateUrl : null,
    className: (0, _classnames.default)(_dropdownItemModule.ignore, "unstyled")
  }, item.data.text)));
};

var _default = DropdownItem;
exports.default = _default;