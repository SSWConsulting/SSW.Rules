import React from 'react';
import classNames from 'classnames';
import Modal from 'react-responsive-modal';
import * as styles from './popup.module.css';

const Popup = (props) => {
  return (
    <div>
      <Modal
        open={props.isVisible}
        onClose={props.onClose}
        showCloseIcon={!!props.showCloseIcon}
        classNames={{
          closeButton: styles.closeButton,
          modalAnimationIn: styles.formEnterModalAnimation,
          modalAnimationOut: styles.formLeaveModalAnimation,
          overlay: 'bg-black/50',
          modal: classNames([
            'sm:max-w-3xl sm:m-5 sm:p-5',
            'w-full mx-0',
            'shadow-none bg-black/0',
            props.className,
          ]),
        }}
        animationDuration={700}
        center
      >
        {props.children}
      </Modal>
    </div>
  );
};

export default Popup;
