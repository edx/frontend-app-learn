import React from 'react';
import { SearchField } from '@edx/paragon';
import PropTypes from 'prop-types';

const CoursewareSearchForm = ({
  searchTerm,
  onSubmit,
  onChange,
  placeholder,
}) => (
  <SearchField.Advanced
    value={searchTerm}
    onSubmit={onSubmit}
    onChange={onChange}
    submitButtonLocation="external"
    className="courseware-search-form"
  >
    <div className="pgn__searchfield_wrapper" data-testid="courseware-search-form">
      <SearchField.Label />
      <SearchField.Input placeholder={placeholder} autoFocus />
      <SearchField.ClearButton />
    </div>
    <SearchField.SubmitButton submitButtonLocation="external" data-testid="courseware-search-form-submit" />
  </SearchField.Advanced>
);

CoursewareSearchForm.propTypes = {
  searchTerm: PropTypes.string,
  onSubmit: PropTypes.func,
  onChange: PropTypes.func,
  placeholder: PropTypes.string,
};

CoursewareSearchForm.defaultProps = {
  searchTerm: undefined,
  onSubmit: undefined,
  onChange: undefined,
  placeholder: undefined,
};

export default CoursewareSearchForm;
