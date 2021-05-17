"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _react = _interopRequireDefault(require("react"));

var _menuPanelModule = require("./menu-panel.module.css");

var _dropdown = _interopRequireDefault(require("../dropdown/dropdown"));

var MenuPanel = function MenuPanel(_ref) {
  var item = _ref.item,
      prefix = _ref.prefix;

  var getRootUrl = function getRootUrl() {
    if (prefix && typeof window !== 'undefined') {
      return (window.location.origin ? window.location.origin + '/' : window.location.protocol + '/' + window.location.host + '/') + prefix + '/';
    }

    return '';
  };

  return /*#__PURE__*/_react.default.createElement(_react.default.Fragment, null, /*#__PURE__*/_react.default.createElement("div", {
    className: _menuPanelModule.MenuImg
  }, /*#__PURE__*/_react.default.createElement("img", {
    src: getRootUrl() + require("../images/" + item.groupImageUrl).default,
    alt: item.text,
    loading: "eager"
  })), /*#__PURE__*/_react.default.createElement(_dropdown.default, {
    items: item.children
  }));
};

var _default = MenuPanel;
exports.default = _default;