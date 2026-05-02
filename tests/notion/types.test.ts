import {
  titleProp, richTextProp, selectProp, multiSelectProp, dateProp, urlProp, numberProp,
} from '../../src/notion/types';

describe('titleProp', () => {
  it('wraps content in title array', () => {
    expect(titleProp('hello')).toEqual({ title: [{ text: { content: 'hello' } }] });
  });
  it('handles empty string', () => {
    expect(titleProp('')).toEqual({ title: [{ text: { content: '' } }] });
  });
});

describe('richTextProp', () => {
  it('wraps content in rich_text array', () => {
    expect(richTextProp('hello')).toEqual({ rich_text: [{ text: { content: 'hello' } }] });
  });
  it('handles empty string', () => {
    expect(richTextProp('')).toEqual({ rich_text: [{ text: { content: '' } }] });
  });
});

describe('selectProp', () => {
  it('returns select with name for non-empty string', () => {
    expect(selectProp('active')).toEqual({ select: { name: 'active' } });
  });
  it('returns null select for null', () => {
    expect(selectProp(null)).toEqual({ select: null });
  });
  it('returns null select for undefined', () => {
    expect(selectProp(undefined)).toEqual({ select: null });
  });
  it('returns null select for empty string', () => {
    expect(selectProp('')).toEqual({ select: null });
  });
});

describe('multiSelectProp', () => {
  it('maps names to multi_select array', () => {
    expect(multiSelectProp(['a', 'b'])).toEqual({ multi_select: [{ name: 'a' }, { name: 'b' }] });
  });
  it('returns empty array for empty input', () => {
    expect(multiSelectProp([])).toEqual({ multi_select: [] });
  });
});

describe('dateProp', () => {
  it('converts unix timestamp to ISO date string', () => {
    expect(dateProp(1705276800)).toEqual({ date: { start: '2024-01-15' } });
  });
  it('returns null date for null', () => {
    expect(dateProp(null)).toEqual({ date: null });
  });
  it('returns null date for undefined', () => {
    expect(dateProp(undefined)).toEqual({ date: null });
  });
  it('returns null date for zero', () => {
    expect(dateProp(0)).toEqual({ date: null });
  });
});

describe('urlProp', () => {
  it('returns the url value', () => {
    expect(urlProp('https://example.com')).toEqual({ url: 'https://example.com' });
  });
  it('returns null for null', () => {
    expect(urlProp(null)).toEqual({ url: null });
  });
  it('returns null for undefined', () => {
    expect(urlProp(undefined)).toEqual({ url: null });
  });
});

describe('numberProp', () => {
  it('wraps a positive number', () => {
    expect(numberProp(42)).toEqual({ number: 42 });
  });
  it('wraps zero correctly (not null)', () => {
    expect(numberProp(0)).toEqual({ number: 0 });
  });
  it('returns null for null', () => {
    expect(numberProp(null)).toEqual({ number: null });
  });
  it('returns null for undefined', () => {
    expect(numberProp(undefined)).toEqual({ number: null });
  });
});
