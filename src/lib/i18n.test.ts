import { afterEach, describe, expect, it } from 'vitest';
import {
  detectSystemLanguage,
  getLanguage,
  localizeError,
  resolveLanguage,
  setLanguage,
  t,
} from './i18n';

afterEach(() => {
  setLanguage('en');
});

describe('i18n', () => {
  it('switches UI strings and interpolates values', () => {
    setLanguage('zh');
    expect(t('viewMode.wysiwyg')).toBe('实时预览');
    expect(t('tabs.closeAria', { name: 'note.md' })).toBe(
      '关闭 note.md',
    );

    setLanguage('en');
    expect(t('viewMode.wysiwyg')).toBe('Live Preview');
    expect(t('tabs.closeAria', { name: 'note.md' })).toBe(
      'Close note.md',
    );
    expect(getLanguage()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('detects Chinese systems and falls back to English', () => {
    const original = Object.getOwnPropertyDescriptor(
      navigator,
      'language',
    );
    try {
      Object.defineProperty(navigator, 'language', {
        configurable: true,
        get: () => 'zh-CN',
      });
      expect(detectSystemLanguage()).toBe('zh');

      Object.defineProperty(navigator, 'language', {
        configurable: true,
        get: () => 'fr-FR',
      });
      expect(detectSystemLanguage()).toBe('en');
    } finally {
      if (original) {
        Object.defineProperty(navigator, 'language', original);
      } else {
        delete (navigator as { language?: string }).language;
      }
    }
  });

  it('resolves explicit and system language preferences', () => {
    expect(resolveLanguage('zh')).toBe('zh');
    expect(resolveLanguage('en')).toBe('en');
    expect(resolveLanguage('system')).toBe(detectSystemLanguage());
  });

  it('localizes backend errors for English while keeping details', () => {
    setLanguage('en');
    expect(localizeError('读取笔记失败：No such file')).toBe(
      'Failed to read note: No such file',
    );
    expect(localizeError('“note.md”已存在')).toBe(
      '“note.md” already exists',
    );
    expect(localizeError('路径无效')).toBe('Invalid path');
    expect(localizeError('Unknown failure')).toBe('Unknown failure');

    setLanguage('zh');
    expect(localizeError('路径无效')).toBe('路径无效');
  });
});
