(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['./bibleText', './bibleIndexes'], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory(require('./bibleText'), require('./bibleIndexes'));
  } else {
    root.bibleSearch = factory(root.bibleText, root.bibleIndexes);
  }
}(this, function(bibleText, bibleIndexes) {
  var Searcher = {
    onError: function(err, source) { console.error(source ? err + ": " + source : err); },
    onTitle: function(title) { console.info("---- " + title + " ----"); },
    onTextLine: function(prefix, text) { console.info(prefix + " " + text); }
  };
  var setOptions = function(opts) { for (var att in opts) Searcher[att] = opts[att]; };
  var valideLine = function(mainLine, bookName, chapterIndex, line) {
    if (mainLine == -1) Searcher.onError("找不到書名", bookName);
    else if (mainLine == -2) Searcher.onError("章節不存在", bookName + " " + chapterIndex);
    else if (mainLine == -3) Searcher.onError("句子不存在", bookName + " " + chapterIndex + ":" + line);
    else return true;
    return false;
  };
  var findLines = function(startLine, endLine, bookName) {
    for (var i = startLine; i <= endLine; i++) {
      var l = bibleText[i], spaceIndex = l.indexOf(' ');
      if (spaceIndex > 0) Searcher.onTextLine(l.substring(0, spaceIndex), l.substring(1 + spaceIndex));
      else Searcher.onTextLine('', l);
    }
  };
  var find = function(bookName, iChapterIndex1, iLine1, iChapterIndex2, iLine2) {
    var bookIndex = bibleIndexes.getBookIndex(bookName);
    var chapterIndex1 = iChapterIndex1 === -1 ? 1 : iChapterIndex1;
    var chapterIndex2 = iChapterIndex2 === -1 ? (iChapterIndex1 === -1 ? bibleIndexes.getTotalChapters(bookIndex) : iChapterIndex1) : iChapterIndex2;
    var line1 = iLine1 === -1 ? 1 : iLine1;
    var line2 = iLine2 === -1 ? bibleIndexes.getTotalLines(bookIndex, chapterIndex2) : iLine2;
    var startLine = bibleIndexes.searchLine(bookIndex, chapterIndex1, line1);
    var endLine = bibleIndexes.searchLine(bookIndex, chapterIndex2, line2);
    if (!valideLine(startLine, bookName, chapterIndex1, line1) || !valideLine(endLine, bookName, chapterIndex2, line2)) return false;
    if (chapterIndex1 > chapterIndex2) return Searcher.onError("章節順序錯誤", bookName), false;
    if (chapterIndex1 === chapterIndex2 && line2 < line1) return Searcher.onError("句子順序錯誤", bookName), false;
    var title = bibleIndexes.getFullName(bookName);
    if (chapterIndex1 === chapterIndex2) {
      title += ' ' + chapterIndex1;
      if (line1 === line2) title += ":" + line1;
      else if (!(iLine1 === -1 && iLine2 === -1)) title += ":" + line1 + "-" + line2;
    }
    Searcher.onTitle(title); findLines(startLine, endLine, bookName); return true;
  };
  var indexSearch = function(query) {
    if (!query) query = '';
    var reBooks = /\s*([\u4e00-\u9fa5]{1,10})([\s0-9\:：•\-－,，]*)/g;
    var re = /\s*•?\s*([0-9]+)\s*(?:[:：]\s*([0-9]+)(?:\s*[-－]\s*([0-9]+))?((?:\s*[,，]\s*[0-9]+)*))?/g;
    var m;
    while ((m = reBooks.exec(query)) !== null) {
      if (m.index === reBooks.lastIndex) reBooks.lastIndex++;
      var bookName = m[1], indexes = m[2].trim(), m2;
      if (indexes === '') find(bookName, -1, -1, -1, -1);
      else while ((m2 = re.exec(indexes)) !== null) {
        if (m2.index === re.lastIndex) re.lastIndex++;
        var c = m2[1] ? parseInt(m2[1]) : -1, l1 = m2[2] ? parseInt(m2[2]) : -1, l2 = m2[3] ? parseInt(m2[3]) : -1;
        if (l2 !== -1) find(bookName, c, l1, c, l2); else find(bookName, c, l1, c, l1);
      }
    }
  };
  Searcher.indexSearch = indexSearch; Searcher.setOptions = setOptions; return Searcher;
}));
