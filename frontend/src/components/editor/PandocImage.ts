import { ReactNodeViewRenderer } from '@tiptap/react'
import Image from '@tiptap/extension-image'
import PandocImageComponent from './PandocImageComponent'

export const PandocImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: '100%',
        parseHTML: element => {
          const title = element.getAttribute('title') || '';
          const match = title.match(/width=([^\s]+)/);
          if (match) return match[1];
          return element.getAttribute('width') || '100%';
        },
        renderHTML: attributes => {
          if (!attributes.width) return {}
          return { width: attributes.width }
        },
      },
      align: {
        default: 'center',
        parseHTML: element => {
          const title = element.getAttribute('title') || '';
          const match = title.match(/align=([^\s]+)/);
          if (match) return match[1];
          return element.getAttribute('data-align') || 'center';
        },
        renderHTML: attributes => {
          if (!attributes.align) return {}
          return { 'data-align': attributes.align }
        }
      },
      title: {
        default: null,
        parseHTML: element => element.getAttribute('title'),
        renderHTML: attributes => {
          const w = attributes.width && attributes.width !== '100%' ? `width=${attributes.width}` : '';
          const a = attributes.align && attributes.align !== 'center' ? `align=${attributes.align}` : '';
          const parts = [w, a].filter(Boolean).join(' ');
          return parts ? { title: parts } : {};
        }
      }
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(PandocImageComponent)
  }
})
