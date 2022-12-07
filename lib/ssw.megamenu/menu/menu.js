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

var _menuModule = require("./menu.module.css");

var _Menu = require("ssw.megamenu");

var _reactFontawesome = require("@fortawesome/react-fontawesome");

var _freeSolidSvgIcons = require("@fortawesome/free-solid-svg-icons");

var _classnames = _interopRequireDefault(require("classnames"));

var _axios = _interopRequireDefault(require("axios"));

var searchUrl = "https://www.google.com.au/search?q=site:ssw.com.au%20";

var Menu = /*#__PURE__*/function (_React$Component) {
  (0, _inherits2.default)(Menu, _React$Component);

  var _super = (0, _createSuper2.default)(Menu);

  function Menu() {
    (0, _classCallCheck2.default)(this, Menu);
    return _super.apply(this, arguments);
  }

  (0, _createClass2.default)(Menu, [{
    key: "menu_Search",
    value: function menu_Search(search) {
      if (window) {
        window.open(searchUrl + search);
      }
    }
  }, {
    key: "handleKeyDownOnMenuSearchInput",
    value: function handleKeyDownOnMenuSearchInput(event) {
      if (event.key === "Enter") {
        this.menu_Search(event.target.value);
      }
    }
  }, {
    key: "render",
    value: function render() {
      var _this = this;

      var menuModel = this.props.menuModel;
      return (
        /*#__PURE__*/
        // this.state.menuModel &&
        _react.default.createElement("div", {
          className: _menuModule.MegaMenu
        }, /*#__PURE__*/_react.default.createElement("div", {
          className: _menuModule.menuContent
        }, /*#__PURE__*/_react.default.createElement("div", {
          className: (0, _classnames.default)(_menuModule.menuMobile, _menuModule.visibleXs, _menuModule.visibleSm)
        }, /*#__PURE__*/_react.default.createElement("div", {
          className: _menuModule.sbToggleLeft,
          onClick: function onClick() {
            return _this.props.onClickToggle();
          }
        }, /*#__PURE__*/_react.default.createElement(_reactFontawesome.FontAwesomeIcon, {
          icon: _freeSolidSvgIcons.faBars
        }))), /*#__PURE__*/_react.default.createElement(_Menu.Menu, {
          prefix: this.props.prefix,
          menuModel: menuModel
        }), /*#__PURE__*/_react.default.createElement("div", {
          className: _menuModule.menuSearch
        }, /*#__PURE__*/_react.default.createElement("input", {
          type: "text",
          className: _menuModule.searchBox,
          onKeyDown: function onKeyDown(event) {
            return _this.handleKeyDownOnMenuSearchInput(event);
          }
        }))))
      );
    }
  }]);
  return Menu;
}(_react.default.Component);

var Wrapper = /*#__PURE__*/function (_React$Component2) {
  (0, _inherits2.default)(Wrapper, _React$Component2);

  var _super2 = (0, _createSuper2.default)(Wrapper);

  function Wrapper(props) {
    var _this2;

    (0, _classCallCheck2.default)(this, Wrapper);
    _this2 = _super2.call(this, props);
    _this2.state = {
      menuModel: require("../data/menu.json"),
      menuLoaded: false
    };
    return _this2;
  }

  (0, _createClass2.default)(Wrapper, [{
    key: "componentDidMount",
    value: function componentDidMount() {
      var currentComponent = this;

      _axios.default.get("https://SSWConsulting.github.io/SSW.Website.Menu.json/menu.json").then(function (response) {
        currentComponent.setState({
          menuModel: response.data
        });
      }).catch(function (error) {
        console.log(error);
      });
    }
  }, {
    key: "render",
    value: function render() {
      var _this$state = this.state,
        menuModel = _this$state.menuModel,
        menuLoaded = _this$state.menuLoaded;
      return /*#__PURE__*/_react.default.createElement(Menu, Object.assign({
        menuModel: menuModel,
        menuLoaded: menuLoaded
      }, this.props));
    }
  }]);
  return Wrapper;
}(_react.default.Component);

var _default = Wrapper;
exports.default = _default;
