import { Factory } from 'rosie'; // eslint-disable-line import/no-extraneous-dependencies
import '../../../shared/data/__factories__/block.factory';
import { buildSimpleCourseBlocks } from '../../../shared/data/__factories__/courseBlocks.factory';

Factory.define('sequenceMetadata')
  .option('courseId', (courseId) => {
    if (courseId) {
      return courseId;
    }
    throw new Error('courseId must be specified for sequenceMetadata factory.');
  })
  // An array of units
  .option('unitBlocks', ['courseId'], courseId => ([
    Factory.build(
      'block',
      { type: 'vertical' },
      { courseId },
    ),
  ]))
  .option(
    'sequenceBlock', ['courseId', 'unitBlocks'], (courseId, unitBlocks) => (
      Factory.build(
        'block',
        { type: 'sequential', children: unitBlocks.map(unitBlock => unitBlock.id) },
        { courseId },
      )
    ),
  )
  .attr('element_id', ['sequenceBlock'], sequenceBlock => sequenceBlock.block_id)
  .attr('item_id', ['sequenceBlock'], sequenceBlock => sequenceBlock.id)
  .attr('display_name', ['sequenceBlock'], sequenceBlock => sequenceBlock.display_name)
  .attr('gated_content', ['sequenceBlock'], sequenceBlock => ({
    gated: false,
    prereq_url: null,
    prereq_id: `${sequenceBlock.id}-prereq`,
    prereq_section_name: `${sequenceBlock.display_name}-prereq`,
    gated_section_name: sequenceBlock.display_name,
  }))

  .attr('decoded_id', ['sequenceBlock'], sequenceBlock => sequenceBlock.decoded_id)
  .attr('hash_key', ['sequenceBlock'], sequenceBlock => sequenceBlock.hash_key)
  .attr('items', ['unitBlocks', 'sequenceBlock'], (unitBlocks, sequenceBlock) => unitBlocks.map(
    unitBlock => ({
      href: '',
      graded: unitBlock.graded,
      id: unitBlock.id,
      bookmarked: unitBlock.bookmarked || false,
      path: `Chapter Display Name > ${sequenceBlock.display_name} > ${unitBlock.display_name}`,
      type: unitBlock.type,
      hash_key: unitBlock.hash_key,
      complete: unitBlock.complete || null,
      content: '',
      page_title: unitBlock.display_name,
      contains_content_type_gated_content: unitBlock.contains_content_type_gated_content,
      decoded_id: unitBlock.decoded_id,
    }),
  ))
  .attrs({
    exclude_units: true,
    position: null,
    next_url: null,
    tag: 'sequential',
    save_position: true,
    prev_url: null,
    is_time_limited: false,
    is_hidden_after_due: false,
    show_completion: true,
    banner_text: null,
    format: 'Homework',
  });

/**
 * Build a simple course and simple metadata for its sequence.
 */
export default function buildSimpleCourseAndSequenceMetadata(options = {}) {
  const courseMetadata = options.courseMetadata || Factory.build('courseMetadata', {
    course_access: {
      has_access: false,
    },
  });
  const courseId = courseMetadata.id;
  const simpleCourseBlocks = buildSimpleCourseBlocks(courseId, courseMetadata.name, options);
  const { unitBlocks, sequenceBlocks } = simpleCourseBlocks;
  const sequenceMetadata = options.sequenceMetadata || sequenceBlocks.map(block => Factory.build(
    'sequenceMetadata',
    {},
    {
      courseId, unitBlocks, sequenceBlock: block,
    },
  ));
  return {
    ...simpleCourseBlocks,
    courseMetadata,
    sequenceMetadata,
  };
}
