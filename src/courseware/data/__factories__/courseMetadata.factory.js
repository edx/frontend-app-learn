import { Factory } from 'rosie'; // eslint-disable-line import/no-extraneous-dependencies

import courseMetadataBase from '../../../shared/data/__factories__/courseMetadataBase.factory';

Factory.define('courseMetadata')
  .extend(courseMetadataBase)
  .option('host', '')
  .attrs({
    content_type_gating_enabled: false,
    course_expired_message: null,
    end: null,
    enrollment_start: null,
    enrollment_end: null,
    name: 'Demonstration Course',
    offer_html: null,
    short_description: null,
    start: '2013-02-05T05:00:00Z',
    start_display: 'Feb. 5, 2013',
    start_type: 'timestamp',
    pacing: 'instructor',
    enrollment: {
      mode: null,
      is_active: null,
    },
    verified_mode: {
      access_expiration_date: null,
      currency: 'USD',
      upgrade_url: 'http://localhost:18130/basket/add/?sku=8CF08E5',
      sku: '8CF08E5',
      price: 149,
      currency_symbol: '$',
    },
    show_calculator: false,
    license: 'all-rights-reserved',
    course_access: {
      has_access: true,
      user_fragment: null,
      developer_message: null,
      user_message: null,
      error_code: null,
      additional_context_user_message: null,
    },
    notes: {
      visible: true,
      enabled: false,
    },
    marketing_url: null,
    celebrations: null,
    enroll_alert: null,
    course_exit_page_is_active: true,
    user_has_passing_grade: false,
    certificate_data: null,
    verify_identity_url: null,
    verification_status: 'none',
    linkedin_add_to_profile_url: null,
    related_programs: null,
    user_needs_integrity_signature: false,
    is_mfe_special_exams_enabled: false,
    is_mfe_proctored_exams_enabled: false,
    recommendations: null,
    mfe_short_url_is_active: true,
  });
