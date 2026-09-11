import { Mark, mergeAttributes } from '@tiptap/core'

export const AnswerErrorSpanMark = Mark.create({
  name: 'answerErrorSpan',

  parseHTML() {
    return [
      { tag: 'span.answer-error' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'answer-error' }), 0]
  },
})
