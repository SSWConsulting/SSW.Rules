import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const RadioButton = ({
  id,
  name,
  value,
  selectedOption,
  handleOptionChange,
  labelText,
  additionalClassName,
  icon,
}) => {
  const labelClassName = `${additionalClassName} min-w-200px bg-stone-200 bg-no-repeat bg-10px p-3 ml-1 cursor-pointer hover:bg-neutral-600 hover:text-white peer-checked:bg-neutral-600 peer-checked:text-white peer-focus:bg-neutral-600`;

  return (
    <div>
      <input
        type="radio"
        id={id}
        name={name}
        value={value}
        checked={selectedOption === value}
        onChange={handleOptionChange}
        className="peer opacity-0 fixed"
      />
      <label className={labelClassName} htmlFor={id}>
        <FontAwesomeIcon icon={icon} size="lg" className="mr-4" />
        {labelText}
      </label>
    </div>
  );
};

export default RadioButton;

RadioButton.propTypes = {
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  selectedOption: PropTypes.string,
  handleOptionChange: PropTypes.func,
  labelText: PropTypes.string.isRequired,
  additionalClassName: PropTypes.string,
  icon: PropTypes.object,
};
