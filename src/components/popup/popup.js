import React from 'react';
import Modal from 'react-responsive-modal';
import 'react-responsive-modal/styles.css';
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
          modal: [
            'sm:max-w-2xl sm:m-5 sm:p-5',
            'w-full mx-0',
            'shadow-none bg-black/0',
            props.className,
          ].join(' '),
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
