import { Factory } from 'rosie'; // eslint-disable-line import/no-extraneous-dependencies

import { buildMinimalCourseBlocks } from '../../../shared/data/__factories__/courseBlocks.factory';

Factory.define('outlineTabData')
  .option('courseId', 'course-v1:edX+DemoX+Demo_Course')
  .option('host', 'http://localhost:18000')
  .option('date_blocks', [])
  .attr('course_blocks', ['courseId'], courseId => {
    const { courseBlocks } = buildMinimalCourseBlocks(courseId);
    return {
      blocks: courseBlocks.blocks,
    };
  })
  .attr('dates_widget', ['date_blocks'], (dateBlocks) => ({
    course_date_blocks: dateBlocks,
  }))
  .attr('resume_course', ['host', 'courseId'], (host, courseId) => ({
    has_visited_course: false,
    url: `${host}/courses/${courseId}/jump_to/block-v1:edX+Test+Block@12345abcde`,
  }))
  .attr('verified_mode', ['host'], (host) => ({
    access_expiration_date: '2050-01-01T12:00:00',
    currency: 'USD',
    currency_symbol: '$',
    price: 149,
    sku: 'ABCD1234',
    upgrade_url: `${host}/dashboard`,
  }))
  .attrs({
    has_scheduled_content: null,
    access_expiration: null,
    can_show_upgrade_sock: false,
    cert_data: {
      cert_status: null,
      cert_web_view_url: null,
      certificate_available_date: null,
      download_url: null,
    },
    course_goals: {
      goal_options: [],
      selected_goal: null,
    },
    course_tools: [
      {
        analytics_id: 'edx.bookmarks',
        title: 'Bookmarks',
        url: 'https://example.com/bookmarks',
      },
    ],
    dates_banner_info: {
      content_type_gating_enabled: false,
      missed_gated_content: false,
      missed_deadlines: false,
    },
    enroll_alert: {
      can_enroll: true,
      extra_text: 'Contact the administrator.',
    },
    handouts_html: '<ul><li>Handout 1</li></ul>',
    offer: null,
    welcome_message_html: '<p>Welcome to this course!</p>',
    mfe_short_url_is_active: true,
  });
