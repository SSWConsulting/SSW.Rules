import React from 'react';
//.JS file needed for this Import...
import GavelIcon from '-!svg-react-loader!../../images/gavel.svg';
import { NumericFormat } from 'react-number-format';

export const RuleCountBlock = ({ hideCount, ruleTotalNumber, label }) => {
  return (
    <section className="rules-counter">
      {!hideCount && (
        <div className="grid grid-cols-6">
          <div className="col-span-1 col-start-2">
            <GavelIcon className="gavel-icon" />
          </div>
          <div className="col-span-2">
            <div className="text-3xl font-semibold text-ssw-red">
              <NumericFormat
                value={ruleTotalNumber}
                displayType={'text'}
                thousandSeparator={true}
              />
            </div>
            <p>{label}</p>
          </div>
        </div>
      )}
    </section>
  );
};
