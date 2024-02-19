import React from 'react';
import classNames from 'classnames';
import Modal from 'react-responsive-modal';
import PropTypes from 'prop-types';
import * as styles from './popup.module.css';

const Popup = ({ isVisible, onClose, showCloseIcon, className, children }) => {
  return (
    <div>
      <Modal
        open={isVisible}
        onClose={onClose}
        showCloseIcon={!!showCloseIcon}
        classNames={{
          closeButton: styles.closeButton,
          modalAnimationIn: styles.formEnterModalAnimation,
          modalAnimationOut: styles.formLeaveModalAnimation,
          overlay: 'bg-black/50',
          modal: classNames([
            'sm:max-w-3xl sm:m-5 sm:p-5',
            'w-full mx-0',
            'shadow-none bg-black/0',
            className,
          ]),
        }}
        animationDuration={700}
        center
      >
        {children}
      </Modal>
    </div>
  );
};

export default Popup;

Popup.propTypes = {
  isVisible: PropTypes.bool,
  showCloseIcon: PropTypes.bool,
  onClose: PropTypes.func,
  className: PropTypes.string,
  children: PropTypes.node,
};
