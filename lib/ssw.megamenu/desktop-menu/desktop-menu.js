"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _classCallCheck2 = _interopRequireDefault(require("@babel/runtime/helpers/esm/classCallCheck"));

var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/esm/createClass"));

var _inherits2 = _interopRequireDefault(require("@babel/runtime/helpers/esm/inherits"));

var _createSuper2 = _interopRequireDefault(require("@babel/runtime/helpers/esm/createSuper"));

var _react = _interopRequireDefault(require("react"));

var _desktopMenuModule = require("./desktop-menu.module.css");

var _classnames = _interopRequireDefault(require("classnames"));

var _reactFontawesome = require("@fortawesome/react-fontawesome");

var _freeSolidSvgIcons = require("@fortawesome/free-solid-svg-icons");

var _menuPanel = _interopRequireDefault(require("../menu-panel/menu-panel"));

var DesktopMenu = /*#__PURE__*/function (_React$Component) {
  (0, _inherits2.default)(DesktopMenu, _React$Component);

  var _super = (0, _createSuper2.default)(DesktopMenu);

  function DesktopMenu() {
    (0, _classCallCheck2.default)(this, DesktopMenu);
    return _super.apply(this, arguments);
  }

  (0, _createClass2.default)(DesktopMenu, [{
    key: "render",
    value: // getRootUrl() {
    //   if (this.props.prefix && typeof window !== 'undefined') {
    //     return (
    //       window.location.origin
    //         ? window.location.origin + '/'
    //         : window.location.protocol + '/' + window.location.host + '/') + this.props.prefix + '/';
    //   }
    //   return '';
    // }
    function render() {
      var _this = this;

      return /*#__PURE__*/_react.default.createElement("div", {
        className: (0, _classnames.default)(_desktopMenuModule.menuDrop, _desktopMenuModule.hiddenXs, _desktopMenuModule.hiddenSm)
      }, /*#__PURE__*/_react.default.createElement("ul", null, this.props.menuModel && this.props.menuModel.menuItems.map(function (item, index) {
        return /*#__PURE__*/_react.default.createElement("li", {
          key: index
        }, !item.children && /*#__PURE__*/_react.default.createElement("a", {
          href: item.navigateUrl ? item.navigateUrl : null,
          className: (0, _classnames.default)(_desktopMenuModule.ignore, 'unstyled')
        }, item.text), ' ', item.children && /*#__PURE__*/_react.default.createElement(_react.default.Fragment, null, /*#__PURE__*/_react.default.createElement("a", {
          className: (0, _classnames.default)(_desktopMenuModule.ignore, 'unstyled')
        }, item.text, " ", /*#__PURE__*/_react.default.createElement(_reactFontawesome.FontAwesomeIcon, {
          icon: _freeSolidSvgIcons.faAngleDown
        })), /*#__PURE__*/_react.default.createElement("div", {
          className: _desktopMenuModule.Menu
        }, /*#__PURE__*/_react.default.createElement(_menuPanel.default, {
          item: item,
          prefix: _this.props.prefix
        }))));
      })));
    }
  }]);
  return DesktopMenu;
}(_react.default.Component);

;
var _default = DesktopMenu;
exports.default = _default;