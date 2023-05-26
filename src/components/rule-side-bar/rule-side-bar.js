import React from 'react';
import Acknowledgements from '../acknowledgements/acknowledgements';
import Categories from '../categories/categories';

const RuleSideBar = ({ authors, categories, location, rule }) => {
  return (
    <div>
      <Acknowledgements authors={authors} />
      <Categories categories={categories} location={location} rule={rule} />
    </div>
  );
};

export default RuleSideBar;
