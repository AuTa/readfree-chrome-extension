(function() {
    var gb = {
        LINK_TYPE: {
            SUBJECT: 0,
            HOME: 1,
            DOULIST: 2,
            UPDATE: 3,
            IMAGE: 4,
            AMAZON_DETAIL: 5
        }
    }

    var port = null;
    var dict = {};

    // search with douban id
    function search(doubanId, linkType, parentTag, siblingTag) {
        if (!port || port.name!='douban-id') {
            chrome.runtime.sendMessage(
                {contentScriptQuery: "readfreeSearchByID", doubanID: doubanId},
                data => {
                    if (data.hits.hit.length) {
                        // Book found
                        var editions = data.hits.hit[0].fields.editions;
                        var types = getTypesFromEditions(editions);
                        var text = 'Readfree';
                        if (types) {
                            switch (linkType) {
                                case gb.LINK_TYPE.SUBJECT:
                                    text = 'Readfree (' + types + ')';
                                    break;
    
                                default:
                                    text = types;
                            }
                        }
                        var url = 'https://readfree.me/book/' + doubanId;
    
                        var panel = getLinkStyle(linkType, url, text);
                        if (siblingTag) {
                            parentTag.insertBefore(panel, siblingTag);
                        }
                        else {
                            parentTag.appendChild(panel);
                        }
                        parentTag.setAttribute('has-readfree', '1');
                    }
                }
            )
        }
    }

    function getTypesFromEditions(editions) {
        var result = [];
        for (var i = 0; i < editions.length; ++i) {
            var suffixId = editions[i].lastIndexOf('.');
            if (suffixId > -1) {
                var suffix = editions[i].substr(suffixId + 1).toLowerCase();
                if (result.indexOf(suffix) === -1) {
                    result.push(suffix);
                }
            }
        }
        return result.join(', ');
    }

    function searchIsbn(isbn, linkType, parentTag) {
        if (!port || port.name!='readfree-search') {
          port = chrome.runtime.connect({name: 'readfree-search'});
          port.onMessage.addListener(function(msg) {
            var url = msg.url;
            if (!msg.success) {
              dict[url].found = false;
              return;
            }
            dict[url].found = true;
            dict[url].url = msg.readfreeUrl;
            var task;
            while (dict[url].tasks.length>0) {
              task = dict[url].tasks.pop();
              var panel = getLinkStyle(task.linkType, msg.readfreeUrl);
              task.parentTag.appendChild(panel);
              task.parentTag.setAttribute('has-readfree', '1');
            }
          });
        }
        var url = 'https://readfree.me/search/?q=' + isbn;
        console.log(url);
        if (!dict[url]) {
          dict[url] = {
            tasks:[]
          };
        }
        if (dict[url].found){
          var panel = getLinkStyle(linkType, url);
          parentTag.appendChild(panel);
          parentTag.setAttribute('has-readfree', '1');
        } else if (dict[url].found==undefined){
          dict[url].tasks.push({
            linkType:linkType,
            parentTag:parentTag
          })
          port.postMessage({
            url: url
          });
        }
    }

    function getLinkStyle(linkType, readfreeUrl, linkText) {
        var className = null;
        var text = null;
        if (linkType === gb.LINK_TYPE.SUBJECT) {
            className = 'rf-book-page-main-link';
            text = 'ReadFree!';
        } else if (linkType === gb.LINK_TYPE.HOME) {
            className = 'rf-douban-home-link';
            text = 'ReadFree!';
        } else if (linkType === gb.LINK_TYPE.IMAGE) {
            className = 'rf-normal-link';
            text = 'R!';
        } else if (linkType === gb.LINK_TYPE.AMAZON_DETAIL) {
            className = 'rf-amazon-detail-link';
            text = 'ReadFree!';
        }
        if (className !== null) {
            var ahref = document.createElement('a');
            ahref.setAttribute('href', readfreeUrl);
            ahref.setAttribute('target', '_blank');
            ahref.setAttribute('class', className);
            ahref.innerHTML = linkText || text;
            return ahref;
        }
        return null;
    }


    function insertCss() {
        // insert css
        var style = document.createElement('style');
        // webkit hack
        style.appendChild(document.createTextNode(''));
        // insert to head
        document.head.appendChild(style);

        // rules
        var primaryColor = '#37a';
        var rules = {
            '.rf-book-page-main-link': {
                background: primaryColor + ' !important',
                color: 'white !important',
                'font-size': '0.8em',
                padding: '4px 8px',
                'border-radius': '2px',
                position: 'relative',
                top: '-10px'
            },
            '.rf-douban-home-link': {
                'max-width': '100%',
                display: 'inline-block',
                margin: '2px 4px',
                'border-radius': '2px',
                padding: '0 5px',
                'text-align': 'center',
                background: primaryColor + ' !important',
                color: 'white !important',
                'font-size': '0.8em'
            },
            '.rf-normal-link': {
                padding: '2px',
                'text-align': 'center',
                position: 'absolute',
                'margin-left': '-64px',
                display: 'inline-block',
                background: primaryColor + ' !important',
                color: 'white !important',
                'font-size': '0.8em'
            },
            '.rf-amazon-detail-link': {
                color: 'white !important',
                background: primaryColor + ' !important',
                padding: '2px 5px',
                display: 'inline-block',
                'font-size': '0.8em'
            }
        };
        for (var ele in rules) {
            var rulesStr = ele + '{';
            for (var attr in rules[ele]) {
                rulesStr += attr + ': ' + rules[ele][attr] + ';';
            }
            rulesStr += '} ';
            style.sheet.insertRule(rulesStr, 0);
        }
    }

    function runDouban() {
        var pathRe = location.pathname.match(/\/(\w+)\/(\d+)\//);

        loadDoubanReadfree();

        // book page
        if (pathRe) {
            var urlClass = pathRe[1];
            var doubanId = pathRe[2];
            if (urlClass === 'subject') {
                var sibling = document.getElementsByTagName('h1')[0];
                search(doubanId, gb.LINK_TYPE.SUBJECT, sibling.parentElement, sibling);
            }
        }

        // douban book
        if (window.location.hostname === 'book.douban.com') {
            var menu = document.getElementsByClassName('nav-items');
            if (menu && menu[0]) {
                // show link only when mouse hover
                menu[0].addEventListener("mouseover", function() {
                    var link = document.getElementById('readfree-menu');
                    if (link) {
                        link.style['display'] = 'inline-block';
                    }
                }, false);
                menu[0].addEventListener("mouseout", function() {
                    var link = document.getElementById('readfree-menu');
                    if (link) {
                        link.style['display'] = 'none';
                    }
                }, false);
            }
        }

        // search readfree when load more
        reloadIndex(['a_nointerest_subject', 'load-more', 'book_x'], function() {
            setTimeout(function() {
                loadDoubanReadfree();
            }, 2000);
        });

        function loadDoubanReadfree() {
            var links = document.getElementsByTagName('a');
            for (var i in links) {
                (function(e) {
                    // ignore those with loaded readfree
                    if (typeof links[e] === 'object'
                            && links[e].parentNode.getAttribute('has-readfree') === '1'
                            || !links[e].href || links[e].href.indexOf('book.douban.com') === -1
                            || links[e].innerHTML.indexOf('豆瓣书店') !== -1)
                    {
                        return;
                    }

                    var re = links[e].href === undefined ? null :
                            links[e].href.match(/\/subject\/(\d+)(\/$|\/\?)/);

                    // ignore those with both title and images
                    if (links[e].className === 'cover') {
                        // cover image in people page, don't ignore
                        search(re[1], gb.LINK_TYPE.IMAGE, links[e].parentNode, links[e]);
                        return;
                    }
                    var children = links[e].childNodes;
                    for (var j in children){
                        if (children[j].tagName === 'IMG') {
                            if (children[j].className === 'climg') {
                                // common list in people page, don't ignore
                                search(re[1], gb.LINK_TYPE.IMAGE,
                                        links[e].parentNode, links[e]);
                            }
                            // ignore other images
                            return;
                        }
                    }
                    // not current book if in book page
                    var re = links[e].href === undefined ? null :
                            links[e].href.match(/\/subject\/(\d+)(\/$|\/\?)/);
                    if (re) {
                        if (!pathRe || (pathRe && pathRe[2]
                                && pathRe[2] !== re[1])) {
                            search(re[1], gb.LINK_TYPE.HOME,
                                    links[e].parentNode, links[e]);
                        }
                    }
                })(i);
            }
        }
    }

    // index page of read
    function reloadIndex(classNameList, callback) {
        for (var cid = 0, clen = classNameList.length; cid < clen; ++cid) {
            var bookX = document.getElementsByClassName(classNameList[cid]);
            if (bookX.length > 0 && callback) {
                for (var i = 0; i < bookX.length; ++i) {
                    bookX[i].addEventListener('click', function() {
                        callback();
                    });
                }
            }
        }
    }


    function searchDoubanIsbn(code, id) {
        $.ajax({
            url: 'https://api.douban.com/v2/book/isbn/' + code,
            dataType: 'json',
            crossDomain: true,
            success: function (data) {
                if (data.msg !== 'book_not_found') {
                    displayAtBookStore(data, id)
                }
            }
        });
    }

    function displayAtBookStore(data, query) {
        if (data.rating) {
            var $rating = $('<a href="' + data.alt
                    + '" target="_blank">豆瓣 '
                    + data.rating.numRaters + ' 人评分：'
                    + data.rating.average + '</a>')
                .css({
                    color: '#072',
                    'background-color': '#edf4ed',
                    display: 'inline-block',
                    padding: '2px 5px',
                    margin: '0 5px'
                });
            $(query).append($rating);
        }
    }

    function runAmazon() {
        var $detail = $('#detail_bullets_id');
        var isbn = 'ISBN: ';
        var isbnFound = false;
        if ($detail.length > 0) {
            var $list = $detail.find('li');
            for (var lid = 0, llen = $list.length; lid < llen; ++lid) {
                var text = $list.eq(lid).text();
                var offset = text.indexOf(isbn);
                if (offset > -1) {
                    var splitOffset = text.indexOf(', ');
                    if (splitOffset > -1) {
                        // multiply isbn, use the one starting with 9
                        if (text[0] === '9') {
                            var code = text.substr(0, splitOffset);
                        } else {
                            var code = text.substr(splitOffset + 2);
                        }
                    } else {
                        var code = text.substr(isbn.length);
                    }
                    searchIsbn(code, gb.LINK_TYPE.AMAZON_DETAIL,
                        $('#bylineInfo')[0]);
                    searchDoubanIsbn(code, '#bylineInfo');
                    isbnFound = true;
                    break;
                }
            }
        }
        if (!isbnFound) {
            // isbn not found, may be ebook
            // search with book name
            var etitle = $('#ebooksProductTitle').text();
            if (etitle !== '') {
                searchDoubanTitle(etitle);
            }
        }

        function searchDoubanTitle(bookName) {
            // remove content
            var remove = ['（', '(', '—'];
            remove.forEach(function (ele) {
                var id = bookName.indexOf(ele);
                if (id > -1) {
                    bookName = bookName.substr(0, id);
                }
            });

            $.ajax({
                url: 'https://api.douban.com/v2/book/search',
                data: {
                    q: bookName
                },
                dataType: 'json',
                crossDomain: true,
                success: function (data) {
                    var amazonPriceText =
                        $('#buybox .print-list-price .a-text-strike')
                            .text();
                    var amazonPrice = null;
                    if (amazonPriceText) {
                        var firstDigit = amazonPriceText.match(/\d/);
                        if (firstDigit !== null) {
                            amazonPrice = parseFloat(
                                amazonPriceText.slice(
                                    amazonPriceText.indexOf(firstDigit)
                                )
                            );
                        }
                    }

                    var useFirst = function () {
                        display(data.books[0]);
                    };

                    if (amazonPrice === null) {
                        // only ebook, no price for print-book
                        useFirst();
                        return;
                    }

                    // check price for sure
                    var hasMatch = false;
                    for (var i = 0, len = data.books.length; i < len; ++i) {
                        var doubanPrice = parseFloat(data.books[i].price);
                        if (amazonPrice === doubanPrice) {
                            display(data.books[i]);
                            hasMatch = true;
                            break;
                        }
                    }

                    if (!hasMatch) {
                        useFirst();
                    }
                }
            });
        }
    }



    function runJd() {
        var $list = $('#parameter2 li');
        for (var i = 0, len = $list.length; i < len; ++i) {
            var $item = $($list[i]);
            if ($item.text().indexOf('ISBN') > -1) {
                var isbn = $item.attr('title');
                searchDoubanIsbn(isbn, '#p-author');
                return;
            }
        }
    }



    insertCss();
    var host = window.location.hostname;
    if (host === 'www.douban.com' || host === 'book.douban.com') {
        runDouban();
    } else if (host === 'www.amazon.cn') {
        runAmazon();
    }
    else if (host === 'item.jd.com') {
        runJd();
    }
})();
