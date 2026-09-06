(function(root){
  const BOOKS={
    GEN:'创世记',EXO:'出埃及记',LEV:'利未记',NUM:'民数记',DEU:'申命记',JOS:'约书亚记',JDG:'士师记',RUT:'路得记',
    '1SA':'撒母耳记上','2SA':'撒母耳记下','1KI':'列王纪上','2KI':'列王纪下','1CH':'历代志上','2CH':'历代志下',
    EZR:'以斯拉记',NEH:'尼希米记',EST:'以斯帖记',JOB:'约伯记',PSA:'诗篇',PRO:'箴言',ECC:'传道书',SNG:'雅歌',
    ISA:'以赛亚书',JER:'耶利米书',LAM:'耶利米哀歌',EZK:'以西结书',DAN:'但以理书',HOS:'何西阿书',JOL:'约珥书',AMO:'阿摩司书',
    OBA:'俄巴底亚书',JON:'约拿书',MIC:'弥迦书',NAM:'那鸿书',HAB:'哈巴谷书',ZEP:'西番雅书',HAG:'哈该书',ZEC:'撒迦利亚书',MAL:'玛拉基书',
    MAT:'马太福音',MRK:'马可福音',LUK:'路加福音',JHN:'约翰福音',ACT:'使徒行传',ROM:'罗马书','1CO':'哥林多前书','2CO':'哥林多后书',
    GAL:'加拉太书',EPH:'以弗所书',PHP:'腓立比书',COL:'歌罗西书','1TH':'帖撒罗尼迦前书','2TH':'帖撒罗尼迦后书','1TI':'提摩太前书','2TI':'提摩太后书',
    TIT:'提多书',PHM:'腓利门书',HEB:'希伯来书',JAS:'雅各书','1PE':'彼得前书','2PE':'彼得后书','1JN':'约翰一书','2JN':'约翰二书','3JN':'约翰三书',JUD:'犹大书',REV:'启示录'
  };
  const ALIASES={
    '创':'GEN','创世记':'GEN','出':'EXO','出埃及记':'EXO','利':'LEV','利未记':'LEV','民':'NUM','民数记':'NUM','申':'DEU','申命记':'DEU',
    '诗':'PSA','诗篇':'PSA','箴':'PRO','箴言':'PRO','赛':'ISA','以赛亚书':'ISA','耶':'JER','耶利米书':'JER','结':'EZK','以西结书':'EZK','但':'DAN','但以理书':'DAN',
    '太':'MAT','马太福音':'MAT','可':'MRK','马可福音':'MRK','路':'LUK','路加福音':'LUK','约':'JHN','约翰福音':'JHN','徒':'ACT','使徒行传':'ACT',
    '罗':'ROM','罗马书':'ROM','林前':'1CO','哥林多前书':'1CO','林后':'2CO','哥林多后书':'2CO','加':'GAL','加拉太书':'GAL','弗':'EPH','以弗所书':'EPH',
    '腓':'PHP','腓立比书':'PHP','西':'COL','歌罗西书':'COL','帖前':'1TH','帖撒罗尼迦前书':'1TH','帖后':'2TH','帖撒罗尼迦后书':'2TH',
    '提前':'1TI','提摩太前书':'1TI','提后':'2TI','提摩太后书':'2TI','多':'TIT','提多书':'TIT','来':'HEB','希伯来书':'HEB','雅':'JAS','雅各书':'JAS',
    '彼前':'1PE','彼得前书':'1PE','彼后':'2PE','彼得后书':'2PE','约一':'1JN','约翰一书':'1JN','约二':'2JN','约翰二书':'2JN','约三':'3JN','约翰三书':'3JN','犹':'JUD','犹大书':'JUD','启':'REV','启示录':'REV'
  };
  function norm(s){return String(s||'').trim().replace(/\s+/g,'').replace(/：/g,':').replace(/[－–—]/g,'-');}
  function parseChineseRef(input){const n=norm(input);const names=Object.keys(ALIASES).sort((a,b)=>b.length-a.length);for(const name of names){if(!n.startsWith(name))continue;const m=n.slice(name.length).match(/^(\d+)(?::(\d+)(?:-(\d+))?)?$/);if(!m)continue;return{osis:ALIASES[name],book_cn:BOOKS[ALIASES[name]],chapter:+m[1],from:m[2]?+m[2]:null,to:m[3]?+m[3]:(m[2]?+m[2]:null),input};}return null;}
  function osisRefToChinese(ref){const m=String(ref||'').toUpperCase().match(/^([1-3]?[A-Z]{2,3})\.(\d+)\.(\d+)(?:-(\d+))?$/);if(!m)return ref;const name=BOOKS[m[1]]||m[1];return `${name}${m[2]}:${m[3]}${m[4]?'-'+m[4]:''}`;}
  function crossRefLabel(row){if(typeof row==='string')return osisRefToChinese(row);const ref=row?.to||row?.target||row?.reference||row?.ref||row?.verse_id||'';return osisRefToChinese(ref);}
  root.JingGuangChineseStudy={BOOKS,ALIASES,parseChineseRef,osisRefToChinese,crossRefLabel,uiLanguage:'zh-CN',defaultTranslation:'cuvs'};
})(this);
