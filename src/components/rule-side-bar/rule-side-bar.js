import React from 'react';
import Acknowledgements from '../acknowledgements/acknowledgements';

const RuleSideBar = ({ authors }) => {
  return (
    <div>
      <Acknowledgements authors={authors} />
    </div>
  );
};

export default RuleSideBar;
