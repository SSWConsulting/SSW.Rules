import { array, bool, func, string } from 'prop-types';
import {
  faSortAmountDown,
  faSortAmountUp,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React from 'react';

const Heading = ({ title, children, isAscending, setIsAscending }) => {
  return (
    <>
      <h6 className={'top-category-header px-4 py-2 flex rounded-t'}>
        <button
          onClick={() => setIsAscending(!isAscending)}
          className="w-full text-left"
        >
          {title}{' '}
          <span className="number">
            <p
              style={{
                textTransform: 'none',
                display: 'inline-block',
              }}
            ></p>
          </span>
          <span className="absolute right-28">Added BY</span>
          <span className="collapse-icon">
            <FontAwesomeIcon
              icon={isAscending ? faSortAmountUp : faSortAmountDown}
            />
          </span>
        </button>
      </h6>
      {children.length == 0 ? (
        <div className="flex justify-center p-10">
          <FontAwesomeIcon
            icon={faSpinner}
            className="animate-spin text-gray-700 duration-300"
          />
        </div>
      ) : (
        <ol className={'pt-3 px-4 py-2 block'}>{children}</ol>
      )}
    </>
  );
};

export default Heading;

Heading.propTypes = {
  title: string,
  children: array,
  isAscending: bool,
  setIsAscending: func,
};
