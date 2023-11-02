import { defineMessages } from '@edx/frontend-platform/i18n';

const messages = defineMessages({
  searchOpenAction: {
    id: 'learn.coursewareSerch.openAction',
    defaultMessage: 'Search within this course',
    description: 'Aria-label for a button that will pop up Courseware Search.',
  },
  searchCloseAction: {
    id: 'learn.coursewareSerch.closeAction',
    defaultMessage: 'Close the search form',
    description: 'Aria-label for a button that will close Courseware Search.',
  },
  searchModuleTitle: {
    id: 'learn.coursewareSerch.searchModuleTitle',
    defaultMessage: 'Search this course',
    description: 'Title for the Courseware Search module.',
  },
  searchBarPlaceholderText: {
    id: 'learn.coursewareSerch.searchBarPlaceholderText',
    defaultMessage: 'Search',
    description: 'Placeholder text for the Courseware Search input control',
  },
  loading: {
    id: 'learn.coursewareSerch.loading',
    defaultMessage: 'Searching...',
    description: 'Screen reader text to use on the spinner while the search is performing.',
  },
  searchResultsNone: {
    id: 'learn.coursewareSerch.searchResultsNone',
    defaultMessage: 'No results found.',
    description: 'Text to show when the Courseware Search found no results matching the criteria.',
  },
  searchResultsSingular: {
    id: 'learn.coursewareSerch.searchResultsSingular',
    defaultMessage: '1 match found for "{keyword}":',
    description: 'Text to show when the Courseware Search found only one result matching the criteria.',
  },
  searchResultsPlural: {
    id: 'learn.coursewareSerch.searchResultsPlural',
    defaultMessage: '{total} matches found for "{keyword}":',
    description: 'Text to show when the Courseware Search found multiple results matching the criteria.',
  },
  searchResultsError: {
    id: 'learn.coursewareSerch.searchResultsError',
    defaultMessage: 'There was an error on the search process. Please try again in a few minutes. If the problem persists, please contact the support team.',
    description: 'Error message to show to the users when there\'s an error with the endpoint or the returned payload format.',
  },

  // These are translations for labeling the filters
  'filter:none': {
    id: 'learn.coursewareSerch.filter:none',
    defaultMessage: 'All content',
    description: 'Label for the search results filter that shows all content (no filter).',
  },
  'filter:text': {
    id: 'learn.coursewareSerch.filter:text',
    defaultMessage: 'Text',
    description: 'Label for the search results filter that shows results with text content.',
  },
  'filter:video': {
    id: 'learn.coursewareSerch.filter:video',
    defaultMessage: 'Video',
    description: 'Label for the search results filter that shows results with video content.',
  },
});

export default messages;
