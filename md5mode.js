/**
 * BÀN TÀI XỈU MD5 ĐỘC LẬP (TÔNG ĐỎ):
 *  1. Clone trực tiếp từ prefab/node bàn Tài Xỉu thường trong MiniPanel.onLoad -> giữ nguyên model chuẩn của bàn thường,
 *     và mở CÙNG LÚC cả 2 bàn (Tài Xỉu xanh + Tài Xỉu MD5 đỏ) độc lập nhau trên màn hình.
 *  2. Bỏ tính năng Hũ trên bàn MD5, thay bằng logo GO88 ở chính giữa đỉnh bàn.
 *  3. Đổi nền bàn sang bàn đỏ gốc trong atlas + đổi màu toàn bộ nút tròn (kể cả 2 trạng thái nút bàn tay Nặn) sang tông đỏ.
 *  4. Thêm icon mở nhanh "TÀI XỈU MD5" trong vòng xoay MiniGame (popupMinigame).
 */
(function () {
    if (window.MD5Mode) return;

    var S = {
        miniPanel: null,
        tx: null,
        cache: {},
        imgs: {},
        hashTimer: null,
        md5tx: '',
        lastHash: '',
        currentRoundMd5: '',
        pendingNextMd5: '',
        pendingLastHash: '',
        md5Revealed: false,
        md5WaitingReveal: false,
        normalWaitingReveal: false,
        pendingUserRed: null,
        md5PendingLog: null,
        dialogMD5: false,
        dialogsHooked: false,
        wheelAdded: false,
    };

    function warn(e) {
        try { console.error('[MD5Mode]', e); } catch (x) {}
    }

    function setting() {
        if (!cc.RedT) return {scale: 1, getLogs: false, isNan: false, logs: [], data: {taixiu: {}, du_day: {}}};
        cc.RedT.setting = cc.RedT.setting || {};
        if (!cc.RedT.setting.taixiumd5) {
            cc.RedT.setting.taixiumd5 = {
                scale: 1,
                getLogs: false,
                isNan: false,
                logs: [],
                data: {taixiu: {}, du_day: {}},
            };
        }
        if (!cc.RedT.setting.taixiumd5.data) {
            cc.RedT.setting.taixiumd5.data = {taixiu: {}, du_day: {}};
        }
        if (!cc.RedT.setting.taixiumd5.logs) {
            cc.RedT.setting.taixiumd5.logs = [];
        }
        return cc.RedT.setting.taixiumd5;
    }

    function ensureDiceSpineBones(anim, diceVal) {
        if (!anim) return;
        try {
            if (anim.skeletonData && anim.skeletonData._skeletonJson && anim.skeletonData._skeletonJson.animations) {
                var anms = anim.skeletonData._skeletonJson.animations;
                if (anms['1'] && anms['2'] && anms['2'].bones && (!anms['1'].bones || !Object.keys(anms['1'].bones).length)) {
                    anms['1'].bones = JSON.parse(JSON.stringify(anms['2'].bones));
                }
            }
            if (anim.skeletonData && anim.skeletonData._skeletonCache && anim.skeletonData._skeletonCache.findAnimation) {
                var ca1 = anim.skeletonData._skeletonCache.findAnimation('1');
                var ca2 = anim.skeletonData._skeletonCache.findAnimation('2');
                if (ca1 && ca2 && ca1.timelines && ca2.timelines && ca1.timelines.length <= 1 && ca2.timelines.length > 1) {
                    ca1.timelines = [ca1.timelines[0]].concat(ca2.timelines.slice(1));
                    if (anim.invalidAnimationCache) anim.invalidAnimationCache();
                }
            }
            if (anim._skeleton && anim._skeleton.data && anim._skeleton.data.findAnimation) {
                var a1 = anim._skeleton.data.findAnimation('1');
                var a2 = anim._skeleton.data.findAnimation('2');
                if (a1 && a2 && a1.timelines && a2.timelines && a1.timelines.length <= 1 && a2.timelines.length > 1) {
                    a1.timelines = [a1.timelines[0]].concat(a2.timelines.slice(1));
                }
            }
        } catch (errAnim) {}
        if (diceVal >= 1 && diceVal <= 6) {
            try {
                var bGiua = anim.findBone ? anim.findBone('giua10') : null;
                var bMatTren = anim.findBone ? anim.findBone('mat tren10') : null;
                var bMatDuoi = anim.findBone ? anim.findBone('mat duoi10') : null;
                var bBenTrai = anim.findBone ? anim.findBone('ben trai10') : null;
                var bBenPhai = anim.findBone ? anim.findBone('ben phai10') : null;
                var bCtrl13 = anim.findBone ? anim.findBone('control13') : null;
                var bCtrl5 = anim.findBone ? anim.findBone('control5') : null;
                if (bGiua) { bGiua.scaleX = 1; bGiua.scaleY = 0.312; }
                if (bMatTren) { bMatTren.x = -3.41; bMatTren.y = 20.46; bMatTren.scaleX = 1; bMatTren.scaleY = 0.312; }
                if (bMatDuoi) { bMatDuoi.scaleX = 1; bMatDuoi.scaleY = 0.312; }
                if (bBenTrai) { bBenTrai.x = 0; bBenTrai.y = 47.74; bBenTrai.scaleX = 1; bBenTrai.scaleY = 0.312; }
                if (bBenPhai) { bBenPhai.x = 6.82; bBenPhai.y = 37.51; bBenPhai.scaleX = 1; bBenPhai.scaleY = 0.312; }
                if (bCtrl13) { bCtrl13.rotation = 0; bCtrl13.x = 0; bCtrl13.y = 0; bCtrl13.scaleX = 1; bCtrl13.scaleY = 1; }
                if (bCtrl5) { bCtrl5.scaleX = 1; bCtrl5.scaleY = 1; }
                if (anim._skeleton && anim._skeleton.updateWorldTransform) {
                    anim._skeleton.updateWorldTransform();
                }
            } catch (errBones) {}
        }
    }

    // ------------------------------------------------------------------ xử lý ảnh / đổi màu xanh & xám -> đỏ
    function loadImg(u) {
        return S.imgs[u] || (S.imgs[u] = new Promise(function (res) {
            var im = new Image();
            im.onload = function () { res(im); };
            im.onerror = function () { res(null); };
            im.src = u;
        }));
    }

    function recolorBlueToRed(d, alsoGrey) {
        for (var i = 0; i < d.length; i += 4) {
            if (d[i + 3] < 8) continue;
            var r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
            var mx = Math.max(r, g, b), mn = Math.min(r, g, b), df = mx - mn;
            var s = mx > 0 ? df / mx : 0, v = mx, h = 0;
            if (df >= 0.001) {
                if (mx === r) h = ((g - b) / df) % 6;
                else if (mx === g) h = (b - r) / df + 2;
                else h = (r - g) / df + 4;
                h *= 60;
                if (h < 0) h += 360;
            }
            if (s >= 0.08 && v >= 0.05 && h >= 75 && h <= 300) {
                var h2 = 356;
                var s2 = Math.min(1, Math.max(0.72, s * 1.15));
                var v2 = v > 0.45 ? 0.45 + (v - 0.45) * 0.35 : v;
                var c = v2 * s2, hp = h2 / 60, x = c * (1 - Math.abs(hp % 2 - 1)), m = v2 - c, rr, gg, bb;
                if (hp < 1) { rr = c; gg = x; bb = 0; }
                else if (hp < 2) { rr = x; gg = c; bb = 0; }
                else if (hp < 3) { rr = 0; gg = c; bb = x; }
                else if (hp < 4) { rr = 0; gg = x; bb = c; }
                else if (hp < 5) { rr = x; gg = 0; bb = c; }
                else { rr = c; gg = 0; bb = x; }
                d[i]     = Math.round((rr + m) * 255);
                d[i + 1] = Math.round((gg + m) * 255);
                d[i + 2] = Math.round((bb + m) * 255);
            } else if (alsoGrey && s < 0.22 && v >= 0.10 && v <= 0.78) {
                // Dành cho frameNan[0] (nút bàn tay gạch chéo nền xám) -> chuyển nền xám sang đỏ sẫm đồng bộ
                d[i]     = Math.min(255, Math.round(v * 215 + 25));
                d[i + 1] = Math.round(v * 28);
                d[i + 2] = Math.round(v * 28);
            }
        }
    }

    function redFrame(sf, forceGrey) {
        if (!sf || !sf.getTexture()) return Promise.resolve(null);
        var t = sf.getTexture(), rc = sf.getRect();
        var key = t.url + '|' + sf.name + '|' + rc.x + ',' + rc.y + ',' + rc.width + ',' + rc.height + '|' + sf.isRotated() + '|' + (forceGrey ? 1 : 0);
        if (S.cache[key]) return S.cache[key];
        return S.cache[key] = loadImg(t.url).then(function (im) {
            if (!im) return null;
            var rot = sf.isRotated();
            var sw = Math.max(1, (rot ? rc.height : rc.width) | 0);
            var sh = Math.max(1, (rot ? rc.width : rc.height) | 0);
            var cv = document.createElement('canvas');
            cv.width = sw;
            cv.height = sh;
            var cx = cv.getContext('2d');
            cx.drawImage(im, rc.x, rc.y, sw, sh, 0, 0, sw, sh);
            var data = cx.getImageData(0, 0, sw, sh);
            var before = data.data.slice(0), px = data.data;
            recolorBlueToRed(px, !!forceGrey);
            var changed = 0;
            for (var i = 0; i < px.length; i += 4) {
                if (px[i] !== before[i] || px[i + 1] !== before[i + 1] || px[i + 2] !== before[i + 2]) changed++;
            }
            if (changed < 10) return null;
            cx.putImageData(data, 0, 0);
            var tex = new cc.Texture2D();
            tex.initWithElement(cv);
            tex.handleLoadedTexture();
            tex._packable = false;
            var nf = new cc.SpriteFrame();
            nf.setTexture(tex, cc.rect(0, 0, rc.width, rc.height), rot, sf.getOffset(), sf.getOriginalSize());
            nf.insetLeft = sf.insetLeft;
            nf.insetRight = sf.insetRight;
            nf.insetTop = sf.insetTop;
            nf.insetBottom = sf.insetBottom;
            return nf;
        }).catch(function (e) { warn(e); return null; });
    }

    // ------------------------------------------------------------------ trang trí bàn MD5: nền đỏ gốc + logo GO88 + nút tay đỏ
    function styleMD5Board(md5Tx) {
        if (!md5Tx || !md5Tx.TX_Main) return;
        var main = md5Tx.TX_Main;
        var bgNode = main.background;

        // 1. Nền bàn đỏ gốc nằm sẵn trong cùng texture (x: 880, y: 0, w: 880, h: 394)
        var bgSp = bgNode && bgNode.getComponent(cc.Sprite);
        if (bgSp && bgSp.spriteFrame && bgSp.spriteFrame.getTexture()) {
            var origSf = bgSp.spriteFrame;
            var tex = origSf.getTexture();
            if (tex && tex.url) {
                loadImg(tex.url).then(function (im) {
                    if (!im || !bgSp.isValid) return;
                    if (im.width >= 1760) {
                        var cv = document.createElement('canvas');
                        cv.width = 880;
                        cv.height = 394;
                        var cx = cv.getContext('2d');
                        cx.drawImage(im, 880, 0, 880, 394, 0, 0, 880, 394);
                        // Xóa vệt rìa của sprite đĩa nặn nằm sát góc phải dưới trong atlas
                        cx.clearRect(870, 240, 10, 154);
                        var newTex = new cc.Texture2D();
                        newTex.initWithElement(cv);
                        newTex.handleLoadedTexture();
                        newTex._packable = false;
                        var redBgSf = new cc.SpriteFrame();
                        redBgSf.setTexture(newTex, cc.rect(0, 0, 880, 394), false, origSf.getOffset(), origSf.getOriginalSize());
                        bgSp.spriteFrame = redBgSf;
                    } else {
                        redFrame(origSf, false).then(function (nf) {
                            if (nf && bgSp.isValid) bgSp.spriteFrame = nf;
                        });
                    }
                });
            }
        }

        // 2. Xóa tính năng Hũ trên bàn MD5 và thay bằng logo GO88 ở đỉnh bàn
        var new2022 = main.node.getChildByName('new2022');
        if (new2022) {
            new2022.active = false;
            new2022.opacity = 0;
        }
        var jpMain = main.node.getChildByName('Jackpot');
        if (jpMain) jpMain.active = false;

        var titleNode = bgNode && bgNode.getChildByName('TaiXiu_title');
        if (titleNode) {
            titleNode.active = false;
            titleNode.children.forEach(function (c) { c.active = false; });
        }

        if (bgNode && !bgNode.getChildByName('go88_logo_md5')) {
            var logoNode = new cc.Node('go88_logo_md5');
            logoNode.setPosition(0, 184);
            var logoSp = logoNode.addComponent(cc.Sprite);
            logoSp.sizeMode = cc.Sprite.SizeMode.CUSTOM;
            logoNode.width = 186;
            logoNode.height = 83;
            bgNode.addChild(logoNode, 20);

            loadImg('res/raw-assets/a7/a7fa0d08-8c5f-43fe-ba4a-6902a23e3730.png').then(function (im) {
                if (!im || !logoNode.isValid) return;
                var tex = new cc.Texture2D();
                tex.initWithElement(im);
                tex.handleLoadedTexture();
                var sf = new cc.SpriteFrame(tex);
                logoSp.spriteFrame = sf;
                logoNode.width = 186;
                logoNode.height = 83;
            });
        }

        // 3. Đổi màu tất cả các nút xanh trên bàn MD5 (nút tròn viền bàn + bảng chọn tiền cược, không đụng vào bát nặn diaNan hay xúc xắc)
        function walkButtons(n) {
            if (!n || n.name === 'go88_logo_md5') return;
            var sp = n.getComponent(cc.Sprite);
            if (sp && sp.spriteFrame && sp !== bgSp) {
                var isNanSprite = (sp === main.spriteNan || n.name === 'tai-xiu-button-nan');
                redFrame(sp.spriteFrame, isNanSprite).then(function (nf) {
                    if (nf && sp.isValid) sp.spriteFrame = nf;
                });
            }
            for (var i = 0; i < n.children.length; i++) walkButtons(n.children[i]);
        }
        var btnGroup = main.node.getChildByName('button');
        if (btnGroup) walkButtons(btnGroup);
        var boardGroup = (main.TX_Board && main.TX_Board.node) || main.node.getChildByName('board');
        if (boardGroup) walkButtons(boardGroup);

        if (main.frameNan && main.frameNan.length >= 2) {
            main.frameNan = main.frameNan.slice();
            var f0 = main.frameNan[0];
            var f1 = main.frameNan[1];
            // frameNan[1] là nút bàn tay xanh -> đổi sang nút bàn tay đỏ
            redFrame(f1, false).then(function (nf1) {
                if (!nf1) return;
                main.frameNan[1] = nf1;
                if (main.isNan && main.spriteNan && main.spriteNan.isValid) {
                    main.spriteNan.spriteFrame = nf1;
                }
            });
            // frameNan[0] là nút bàn tay tắt (xám) -> đổi nền xám sang đỏ sẫm đồng bộ với các nút đỏ
            redFrame(f0, true).then(function (nf0) {
                if (!nf0) return;
                main.frameNan[0] = nf0;
                if (!main.isNan && main.spriteNan && main.spriteNan.isValid) {
                    main.spriteNan.spriteFrame = nf0;
                }
            });
        }
    }

    // ------------------------------------------------------------------ dòng Chuỗi MD5 trên bàn MD5
    function setChildLabel(node, text) {
        if (!node) return;
        var g = node.getChildByName('getdata');
        var lb = g && g.getComponent(cc.Label);
        if (lb) lb.string = text || '';
    }

    function showMD5FloatingResult(main, t) {
        try {
            if (!main || !t || main._floatingShown) return;
            main._floatingShown = true;
            var isTableOpen = !!(main.node && main.node.active && S.tx && S.tx.node && S.tx.node.active);
            if (isTableOpen) {
                showTableFloatingResult(main, t);
            }
            if (isTableOpen && isGameSoundOn() && main.audioWin && t.win) {
                try { main.audioWin.play(); } catch (e) {}
            }
            try { cc.RedT.send({taixiumd5: {get_new: true}}); } catch (e) {}
        } catch (e) {
            warn(e);
        }
    }

    function revealMD5Result(main) {
        try {
            main = main || (S.tx && S.tx.TX_Main);
            if (!main) return;
            if (S.md5Revealed) return;
            S.md5Revealed = true;
            S.md5WaitingReveal = false;

            // 1. Reveal chuỗi kết quả MD5 và chuyển badge sang "KẾT QUẢ"
            if (S.pendingLastHash) {
                S.lastHash = S.pendingLastHash;
                S.pendingLastHash = '';
            }
            refreshMd5Row();

            // 2. Reveal chấm kết quả cầu trên bàn & bảng thống kê
            var st = setting();
            if (S.md5PendingLog) {
                st.logs.unshift(S.md5PendingLog);
                if (st.logs.length > 120) st.logs.pop();
                S.md5PendingLog = null;
            }
            if (typeof main.dataLogs === 'function') main.dataLogs();
            if (main.nodeKetQua) main.nodeKetQua.active = true;
            if (main.diemSo !== undefined) {
                if (main.labelKetQua) main.labelKetQua.string = main.diemSo;
                if (main.diemSo > 10) {
                    if (main.efTaiColor) main.efTaiColor.active = true;
                    if (main.efTai) main.efTai.active = false;
                } else {
                    if (main.efXiuColor) main.efXiuColor.active = true;
                    if (main.efXiu) main.efXiu.active = false;
                }
            }

            // 3. Hiện hiệu ứng nổi + tiền thắng cược (hoặc trừ tiền)
            showMD5FloatingResult(main, main._results);

            // 4. Đồng bộ số dư tài khoản ở góc dưới màn hình đúng khoảnh khắc mở bát
            if (S.pendingUserRed !== null && S.pendingUserRed !== undefined) {
                var newRed = S.pendingUserRed;
                S.pendingUserRed = null;
                syncUserBalances({red: newRed});
            }
        } catch (e) {
            warn(e);
        }
    }

    function refreshMd5Row() {
        if (!S.tx || !S.tx.TX_Main || !S.tx.TX_Main.background) return;
        var row = S.tx.TX_Main.background.getChildByName('tx_chuoimd5');
        if (!row) return;
        var boardOpen = !!(S.tx.TX_Main.TX_Board && S.tx.TX_Main.TX_Board.node && S.tx.TX_Main.TX_Board.node.active);
        row.active = !boardOpen;
        if (boardOpen) return;
        var tr = setting().time_remain;
        var showResult = tr > 46 && S.md5Revealed && !!S.lastHash;
        var key = row.getChildByName('chuoimd5');
        var res = row.getChildByName('chuoiketqua');
        var cp  = row.getChildByName('COPY');
        if (cp) cp.active = false;
        var activeMd5Text = (tr > 46 && !S.md5Revealed) ? (S.currentRoundMd5 || S.md5tx) : (S.currentRoundMd5 || S.md5tx);
        if (key) { key.active = !showResult; setChildLabel(key, activeMd5Text); }
        if (res) { res.active = showResult; setChildLabel(res, S.lastHash); }
    }

    // ------------------------------------------------------------------ gắn sự kiện các nút dialog bị mất target khi instantiate
    function setDialogMode(isMD5) {
        S.dialogMD5 = !!isMD5;
        try {
            var bg = S.miniPanel.Dialog.TaiXiuLichSuPhien.node.getChildByName('background');
            ['tx_chuoimd5', 'tx_chuoimkq', 'Title'].forEach(function (n) {
                var c = bg && bg.getChildByName(n);
                if (c) c.active = !!isMD5;
            });
        } catch (e) {}
    }

    function hookDialogs(miniPanel) {
        if (S.dialogsHooked || !miniPanel || !miniPanel.Dialog) return;
        S.dialogsHooked = true;
        var dlg = miniPanel.Dialog;

        // Khi mở từ bàn thường -> tắt cờ dialogMD5; nếu dialog đang mở sẵn thì tải lại đúng dữ liệu bàn đó ngay
        var origShowLS = dlg.showTaiXiuLichSu.bind(dlg);
        dlg.showTaiXiuLichSu = function () {
            if (!S._openingMD5Dialog) setDialogMode(false);
            if (dlg.objShow && dlg.objShow !== dlg.TaiXiuLichSu.node) dlg.objShow.active = false;
            var wasActive = dlg.TaiXiuLichSu.node.active;
            var ret = origShowLS();
            if (wasActive) dlg.TaiXiuLichSu.get_data(1);
            return ret;
        };
        var origShowTop = dlg.showTaiXiuTop.bind(dlg);
        dlg.showTaiXiuTop = function () {
            if (!S._openingMD5Dialog) setDialogMode(false);
            if (dlg.objShow && dlg.objShow !== dlg.TaiXiuTop.node) dlg.objShow.active = false;
            var wasActive = dlg.TaiXiuTop.node.active;
            var ret = origShowTop();
            var sv = dlg.TaiXiuTop.node.getComponentInChildren(cc.ScrollView);
            if (sv) sv.scrollToTop(0);
            if (wasActive) dlg.TaiXiuTop.get_data();
            return ret;
        };

        if (dlg.TaiXiuLichSu) {
            dlg.TaiXiuLichSu.get_data = function (page) {
                var p = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : 1;
                var k = S.dialogMD5 ? 'taixiumd5' : 'taixiu';
                var msg = {};
                msg[k] = {get_log: {page: p}};
                cc.RedT.send(msg);
            };
        }
        if (dlg.TaiXiuTop) {
            dlg.TaiXiuTop.get_data = function () {
                var k = S.dialogMD5 ? 'taixiumd5' : 'taixiu';
                var msg = {};
                msg[k] = {get_top: {red: true, taixiu: true}};
                cc.RedT.send(msg);
            };
        }
        if (dlg.TaiXiuLichSuPhien) {
            var lsp = dlg.TaiXiuLichSuPhien;
            var origOnGetPhienClick = lsp.onGetPhienClick.bind(lsp);
            lsp.onGetPhienClick = function (ev) {
                setDialogMode(false);
                return origOnGetPhienClick(ev);
            };
            lsp.getPhien = function (phien) {
                var p = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : null;
                if (p) {
                    cc.RedT.inGame.loading.active = true;
                    var k = S.dialogMD5 ? 'taixiumd5' : 'taixiu';
                    var msg = {};
                    msg[k] = {get_phien: {phien: p}};
                    cc.RedT.send(msg);
                    this.lastLeft = this.lastRight = 0;
                }
            };
            var origLspOnData = lsp.onData.bind(lsp);
            lsp.onData = function (t) {
                if (S.dialogMD5 && setting().logs && setting().logs.length) {
                    var savedLogs = cc.RedT.setting.taixiu.logs;
                    try {
                        cc.RedT.setting.taixiu.logs = setting().logs;
                        origLspOnData(t);
                    } finally {
                        cc.RedT.setting.taixiu.logs = savedLogs;
                    }
                } else {
                    origLspOnData(t);
                }
            };
        }
    }

    function wireMD5Buttons(md5Tx, miniPanel) {
        var main = md5Tx.TX_Main;
        var btnRoot = main.node.getChildByName('button');
        if (btnRoot) {
            var btnHelp = btnRoot.getChildByName('button-help') || btnRoot.getChildByName('tai-xiu-button-help');
            if (btnHelp) {
                var bhComp = btnHelp.getComponent(cc.Button);
                if (bhComp) bhComp.clickEvents = [];
                btnHelp.on('click', function () {
                    cc.RedT.audio.playClick();
                    if (miniPanel.Dialog.showHelpmd5) miniPanel.Dialog.showHelpmd5();
                    else if (miniPanel.Dialog.showhelpTX) miniPanel.Dialog.showhelpTX();
                });
            }
            var btnHistory = btnRoot.getChildByName('button-tutorial') || btnRoot.getChildByName('tai-xiu-button-tutorial');
            if (btnHistory) {
                var btComp = btnHistory.getComponent(cc.Button);
                if (btComp) btComp.clickEvents = [];
                btnHistory.on('click', function () {
                    cc.RedT.audio.playClick();
                    S._openingMD5Dialog = true;
                    try {
                        setDialogMode(true);
                        miniPanel.Dialog.showTaiXiuLichSu();
                    } finally {
                        S._openingMD5Dialog = false;
                    }
                });
            }
            var btnRank = btnRoot.getChildByName('button-rank') || btnRoot.getChildByName('tai-xiu-button-rank');
            if (btnRank) {
                var brComp = btnRank.getComponent(cc.Button);
                if (brComp) brComp.clickEvents = [];
                btnRank.on('click', function () {
                    cc.RedT.audio.playClick();
                    S._openingMD5Dialog = true;
                    try {
                        setDialogMode(true);
                        miniPanel.Dialog.showTaiXiuTop();
                    } finally {
                        S._openingMD5Dialog = false;
                    }
                });
            }
        }

        // Các chấm lịch sử phiên trên bàn MD5
        if (main.dotLogs && main.dotLogs.length) {
            main.dotLogs.forEach(function (dotSp) {
                if (!dotSp || !dotSp.node) return;
                var dotBtn = dotSp.node.getComponent(cc.Button);
                if (dotBtn) {
                    dotBtn.enabled = true;
                    dotBtn.clickEvents = [];
                }
                dotSp.node.on('click', function () {
                    if (!dotSp.node.phien) return;
                    cc.RedT.audio.playClick();
                    setDialogMode(true);
                    miniPanel.Dialog.TaiXiuLichSuPhien.getPhien(dotSp.node.phien);
                });
            });
        }

        // Nút copy chuỗi MD5 / chuỗi kết quả
        var row = main.background && main.background.getChildByName('tx_chuoimd5');
        if (row) {
            var cmd5 = row.getChildByName('chuoimd5');
            var b1 = cmd5 && cmd5.getChildByName('button');
            if (b1) {
                b1.on('click', function () {
                    if (S.md5tx && cc.RedT.CopyToClipboard) cc.RedT.CopyToClipboard(S.md5tx);
                    cc.RedT.send({taixiumd5: {getcopy: {cp: 1}}});
                });
            }
            var ckq = row.getChildByName('chuoiketqua');
            var b2 = ckq && ckq.getChildByName('button');
            if (b2) {
                b2.on('click', function () {
                    if (S.lastHash && cc.RedT.CopyToClipboard) cc.RedT.CopyToClipboard(S.lastHash);
                    cc.RedT.send({taixiumd5: {getcopy: {cp: 2}}});
                });
            }
        }
    }

    // ------------------------------------------------------------------ khởi tạo instance bàn MD5 độc lập
    function setupMD5Instance(miniPanel) {
        var Helper = window.__require('Helper');
        var BrowserUtil = window.__require('BrowserUtil');
        var st = setting();

        var md5Node = cc.instantiate(miniPanel.TaiXiu.node);
        md5Node.name = 'TaiXiuMD5';
        md5Node.active = false;
        miniPanel.minigame.addChild(md5Node);

        var md5Tx = md5Node.getComponent('TaiXiu');
        var md5Main = md5Tx.TX_Main;
        var md5ThongKe = md5Tx.TX_ThongKe;
        var md5Chat = md5Main.TX_Chat;

        miniPanel.TaiXiuMD5 = md5Tx;
        S.tx = md5Tx;

        // Node timePopup giả để không đụng tới badge thời gian của bàn thường trên nút MiniGame
        var dummyPopupNode = new cc.Node('md5DummyTimePopup');
        var dummyPopupLabel = dummyPopupNode.addComponent(cc.Label);
        md5Main.nodeTimePopup = dummyPopupNode;
        md5Main.timePopup = dummyPopupLabel;

        // ---- Override TaiXiuChat (chỉ trên instance MD5) ----
        md5Chat.init = function (t) {
            this.RedT = t;
            if (void 0 !== st.Chat_position) this.node.position = st.Chat_position;
        };
        md5Chat.eventEnd = function (t) {
            if (!this._dragging) return;
            this._dragging = false;
            st.Chat_position = this.node.position;
            if (t && t.stopPropagation) t.stopPropagation();
        };
        md5Chat.onChatClick = function () {
            cc.RedT.send({taixiumd5: {chat: this.input.string}});
            this.clean();
        };
        md5Chat.toggle = function () {
            this.RedT.setTop();
            cc.RedT.audio.playClick();
            this.node.active = st.chat_active = !this.node.active;
            if (this.node.active) {
                if (this.layout && this.layout.updateLayout) this.layout.updateLayout();
                if (this.content && this.content.scrollToBottom) {
                    setTimeout(function () { this.content.scrollToBottom(0.2); }.bind(this), 50);
                }
            }
        };
        md5Chat.closechat = function () {
            this.RedT.setTop();
            this.node.active = st.chat_active = false;
        };

        // ---- Override TaiXiuThongKe (chỉ trên instance MD5) ----
        md5ThongKe.init = function (t) {
            this.RedT = t;
            if (void 0 !== st.tk_position) this.node.position = st.tk_position;
            if (void 0 !== st.tk_active) this.node.active = st.tk_active;
            this.KetQuaDot = this.KetQuaDot.children.map(function (n) { return n.getComponent(cc.Sprite); });
            this.DiemSoCel = this.DiemSoCel.children.map(function (n) {
                n.RedT = n.children.map(function (c) {
                    c = c.getComponent(cc.Sprite);
                    c.text = c.node.children[0].getComponent(cc.Label);
                    return c;
                });
                return n;
            });
            this.dice1_dots = this.dice1_dot.children.map(function (n) { n.text = n.children[0].getComponent(cc.Label); return n; });
            this.dice2_dots = this.dice2_dot.children.map(function (n) { n.text = n.children[0].getComponent(cc.Label); return n; });
            this.dice3_dots = this.dice3_dot.children.map(function (n) { n.text = n.children[0].getComponent(cc.Label); return n; });
            this.tong_dots = this.tong_dot.children.map(function (n) {
                n = n.getComponent(cc.Sprite);
                n.text = n.node.children[0].getComponent(cc.Label);
                return n;
            });
        };
        md5ThongKe.eventEnd = function () {
            st.tk_position = this.node.position;
        };
        md5ThongKe.onToggleClick = function () {
            cc.RedT.audio.playClick();
            this.setTop();
            this.node.active = st.tk_active = !this.node.active;
        };

        // ---- Override TaiXiuMain (chỉ trên instance MD5) ----
        md5Main.init = function (t) {
            this.RedT = t;
            st.data = st.data || {taixiu: {}, du_day: {}};
            this.isNan = false;
            if (void 0 === cc.RedT.util.fontCong) {
                cc.RedT.util.fontCong = this.fontCong;
                cc.RedT.util.fontTru = this.fontTru;
            }
            if (void 0 === st.getLogs) st.getLogs = false;
            if (void 0 === st.isNan) st.isNan = false;
            this.dotLogs = this.dotLogs.children.map(function (n) {
                var sp = n.getComponent(cc.Sprite);
                sp.mod = n.getComponent('TaiXiuMain_logTips');
                return sp;
            });
            this.dotLogs.reverse();
            this.onDiceAnimationFinish = function () {
                this.setDice(true);
                if (!this.isNan) {
                    this.DiaNan();
                }
                this.diceAnimation.node.active = false;
                if (this.xnEffect) this.xnEffect.node.active = false;
            };
            md5Main.DiaNan = function () {
                if (st.time_remain > 46 && this._diceDone === false) return;
                revealMD5Result(this);
            };
            if (void 0 !== st.position) this.node.position = st.position;
            if (st.getLogs) {
                if (void 0 !== st.time_remain) {
                    st.time_remain++;
                    this.nextRealTime();
                }
                this.reLoadGame();
            }
        };

        var origSelectInput = md5Main.onSelectInput;
        if (origSelectInput) {
            md5Main.onSelectInput = function (t, e) {
                var r = origSelectInput.call(this, t, e);
                refreshMd5Row();
                return r;
            };
        }
        if (md5Main.TX_Board && md5Main.TX_Board.onCloseClick) {
            var origBoardClose = md5Main.TX_Board.onCloseClick.bind(md5Main.TX_Board);
            md5Main.TX_Board.onCloseClick = function () {
                var r = origBoardClose();
                refreshMd5Row();
                return r;
            };
        }

        var origMainOnLoad = md5Main.onLoad;
        md5Main.onLoad = function () {
            origMainOnLoad.call(this);
            this.onCuocClick = function () {
                var bet = Helper.getOnlyNumberInString(this.input.string);
                bet = parseInt(bet);
                this.input.string = this.RedT.board ? '' : '0';
                this.TX_Board.node.active = false;
                refreshMd5Row();
                var tr = setting().time_remain;
                if (tr <= 6 || tr > 46) {
                    showTableNotice(this, 'Hết thời gian đặt cược !');
                    return;
                }
                if (isNaN(bet) || bet < 1000) {
                    showTableNotice(this, 'Tiền cược phải lớn hơn 1.000');
                } else {
                    cc.RedT.send({taixiumd5: {cuoc: {select: this.inputOld == 'left', bet: bet}}});
                }
            };
        };

        md5Main.onChangerNan = function () {
            st.isNan = this.isNan = !this.isNan;
            this.spriteNan.spriteFrame = this.isNan ? this.frameNan[1] : this.frameNan[0];
        };
        md5Main.reLoadGame = function () {
            this.regTimeOut2 = setTimeout(function () {
                this.dataLogs();
                if (st.isNan != this.isNan) this.onChangerNan();
                this.onDuDay(st.data.du_day);
                this.onDataTaiXiu(st.data.taixiu);
            }.bind(this), 50);
            this.setPhien();
        };
        md5Main.eventEnd = function () {
            st.position = this.node.position;
        };
        md5Main.setPhien = function () {
            if (!st.logs || !st.logs.length) return;
            var p = st.logs[0].phien + 1;
            this.labelPhien.string = '#' + p;
        };
        md5Main.setDice = function () {
            var show = arguments.length > 0 && void 0 !== arguments[0] && arguments[0];
            var setSf = !(arguments.length > 1 && void 0 !== arguments[1]) || arguments[1];
            var self = this;
            var currentDiceArray = this._currentDices || (st.logs && st.logs[0] && st.logs[0].dice);
            if (!currentDiceArray) return;
            if (this.xnEffect) this.xnEffect.node.active = false;
            this.dice.forEach(function (d, idx) {
                if (setSf && self.diceSF && currentDiceArray[idx]) {
                    d.spriteFrame = self.diceSF[currentDiceArray[idx] - 1];
                }
                d.node.active = show;
            });
            this.xnAnimation.forEach(function (anim, idx) {
                if (!anim) return;
                try {
                    anim.setCompleteListener(null);
                } catch (e0) {}
                if (anim.node) anim.node.active = show;
                if (show && currentDiceArray[idx]) {
                    try {
                        ensureDiceSpineBones(anim, currentDiceArray[idx]);
                        if (anim.setToSetupPose) anim.setToSetupPose();
                        anim.setAnimation(0, '' + currentDiceArray[idx], false);
                        ensureDiceSpineBones(anim, currentDiceArray[idx]);
                    } catch (e) {}
                }
            });
        };
        md5Main.onData = function (t) {
            if (void 0 !== t.get_phien) {
                setDialogMode(true);
                this.RedT.TX_LichSuPhien.onData(t.get_phien);
            }
            if (void 0 !== t.err) {
                if (this.node && this.node.active) {
                    showTableNotice(this, t.err);
                }
            }
            if (void 0 !== t.du_day) {
                Object.assign(st.data.du_day, t.du_day);
                this.onDuDay(t.du_day);
            }
            if (void 0 !== t.taixiu) {
                Object.assign(st.data.taixiu, t.taixiu);
                this.onDataTaiXiu(t.taixiu);
            }
            if (void 0 !== t.get_top) {
                setDialogMode(true);
                this.RedT.TX_Top.onData(t.get_top);
            }
            if (void 0 !== t.chat) this.TX_Chat.onData(t.chat);
            if (void 0 !== t.status) this.status(t.status);
            if (void 0 !== t.get_log) {
                setDialogMode(true);
                this.RedT.TX_LichSu.onData(t.get_log);
            }
            if (void 0 !== t.finish3) {
                st.time_remain = 48;
                this.playTime();
            }
            if (void 0 !== t.logs) {
                st.logs = t.logs;
                this.dataLogs();
                this.setPhien();
                if (st.time_remain > 45) {
                    this.setDice(true);
                    this.nodeTimeWait.active = true;
                    this.timeCuoc.node.active = false;
                }
                st.getLogs = true;
            }
            if (void 0 !== t.time_remain) {
                st.time_remain = t.time_remain;
                this.playTime();
                this.nextRealTime();
            }
            if (void 0 !== t.sync_md5 && t.sync_md5) {
                if (S.md5Revealed || (st.time_remain !== undefined && st.time_remain <= 46) || !S.md5tx) {
                    S.md5tx = t.sync_md5;
                    S.currentRoundMd5 = t.sync_md5;
                } else {
                    S.pendingNextMd5 = t.sync_md5;
                }
            }
            if (void 0 !== t.sync_hash && t.sync_hash !== undefined) {
                if (S.md5Revealed || (st.time_remain !== undefined && st.time_remain <= 46) || !S.lastHash) {
                    S.lastHash = t.sync_hash;
                } else {
                    S.pendingLastHash = t.sync_hash;
                }
            }
            if (void 0 !== t.sync_time) {
                var curTr = st.time_remain;
                if (!this.timeInterval || curTr === undefined || curTr <= 0 || Math.abs(curTr - t.sync_time) >= 2) {
                    st.time_remain = t.sync_time;
                    this.playTime();
                    this.nextRealTime();
                }
            }
            if (void 0 !== t.sync_phien) {
                var latestLogPhien = (st.logs && st.logs[0] && st.logs[0].phien) ? Number(st.logs[0].phien) : 0;
                var checkTr = (void 0 !== t.sync_time) ? t.sync_time : st.time_remain;
                var needResync = !st.getLogs || !latestLogPhien || (checkTr <= 46 && (latestLogPhien + 1) !== Number(t.sync_phien));
                if (needResync) {
                    var nowMs = Date.now();
                    if (!this._lastAutoSyncLogs || (nowMs - this._lastAutoSyncLogs > 2000)) {
                        this._lastAutoSyncLogs = nowMs;
                        var isMd5Open = !!(S.tx && S.tx.node && S.tx.node.active);
                        if (cc.RedT && typeof cc.RedT.send === 'function') {
                            cc.RedT.send({taixiumd5: {view: isMd5Open, getLogs: true}});
                        }
                    }
                }
            }
            if (void 0 !== t.finish) {
                st.getLogs = true;
                if (true) {
                    if (void 0 !== this.timeInterval) clearInterval(this.timeInterval);
                    S.md5Revealed = false;
                    S.md5WaitingReveal = true;
                    this._floatingShown = false;
                    if (S.lastHash) S.pendingLastHash = S.lastHash;
                    S.md5PendingLog = {dice: [t.finish.dices[0], t.finish.dices[1], t.finish.dices[2]], phien: t.finish.phien};
                    this._diceDone = false;
                    this._currentDices = [t.finish.dices[0], t.finish.dices[1], t.finish.dices[2]];
                    this.diemSo = t.finish.dices[0] + t.finish.dices[1] + t.finish.dices[2];
                    this.setDice(true);
                    this.diceAnimation.node.active = true;
                    if (this.xnAnimation[0] && this.xnAnimation[0].setToSetupPose) this.xnAnimation[0].setToSetupPose();
                    if (this.xnAnimation[1] && this.xnAnimation[1].setToSetupPose) this.xnAnimation[1].setToSetupPose();
                    if (this.xnAnimation[2] && this.xnAnimation[2].setToSetupPose) this.xnAnimation[2].setToSetupPose();
                    this.xnAnimation[0].setAnimation(0, 'xi ngau bay ' + t.finish.dices[0], false);
                    this.xnAnimation[1].setAnimation(0, 'xi ngau bay ' + t.finish.dices[1], false);
                    this.xnAnimation[2].setAnimation(0, 'xi ngau bay ' + t.finish.dices[2], false);
                    if (this.xnEffect) this.xnEffect.node.active = false;
                    setTimeout(function () {
                        if (this.xnEffect) this.xnEffect.node.active = false;
                        if (this.diceAnimation) this.diceAnimation.node.active = false;
                    }.bind(this), 2500);
                    if (this.isNan) {
                        setTimeout(function () {
                            if (st.time_remain > 46) {
                                this.diaNan.active = true;
                                this.diaNan.position = cc.v2(0, -8);
                                this.nodeKetQua.active = false;
                            }
                        }.bind(this), 2100);
                        this.nodeTimeWait.active = true;
                    }
                    this.timeCuoc.node.active = false;
                    if (this.node && this.node.active && S.tx && S.tx.node && S.tx.node.active) {
                        playDiceRollSound(this);
                    }
                    var finishRoll = function () {
                        if (this._diceDone) return;
                        this._diceDone = true;
                        if (st.time_remain > 46) {
                            this.labelKetQua.string = this.diemSo;
                            this.nodeTimeWait.active = true;
                            this.onDiceAnimationFinish();
                        }
                    }.bind(this);
                    this.xnAnimation[0].setCompleteListener(function () {
                        setTimeout(finishRoll, 100);
                    });
                    setTimeout(finishRoll, 2550);
                }
                st.time_remain = 61;
                this.playTime();
            }
            refreshMd5Row();
        };
        md5Main.playTime = function () {
            if (void 0 !== this.timeInterval) clearInterval(this.timeInterval);
            this.audioWin.stop();
            this._results = {}; this._stopBetAnnounced = false;
            this.timeInterval = setInterval(function () {
                if (st.time_remain > 46) {
                    if (null !== this.bg_Dice._animator && this.bg_Dice._animator.isPlaying) this.bg_Dice.stop();
                    this.bg_efDice.active = false;
                    if (this.xnEffect) this.xnEffect.node.active = false;
                    var t = Helper.numberPad(st.time_remain - 46, 2);
                    this.timeWait.string = +t;
                    if (st.time_remain < 48) this.efStop();
                    if (st.time_remain < 47) {
                        this.nodeKetQua.active = false;
                        if (this.isNan) this.diaNan.active = false;
                    }
                } else {
                    if (null !== this.bg_Dice._animator && !this.bg_Dice._animator.isPlaying) {
                        var animState = this.bg_Dice.getAnimationState(this.bg_Dice._defaultClip.name);
                        animState.speed = 1;
                        this.bg_Dice._animator.playState(animState);
                    }
                    if (null !== this.bg_Dice._animator && this.bg_Dice._animator.isPlaying) {
                        if (st.time_remain < 7) this.bg_Dice._animator._anims.array[0].speed = 10;
                        else if (st.time_remain < 23) this.bg_Dice._animator._anims.array[0].speed = 6;
                        else if (st.time_remain < 33) this.bg_Dice._animator._anims.array[0].speed = 3;
                    }
                    this.bg_efDice.active = true;
                    this._diceDone = true;
                    if (this.xnEffect) this.xnEffect.node.active = false;
                    if (this.diceAnimation) this.diceAnimation.node.active = false;
                    if (!S.md5Revealed) {
                        revealMD5Result(this);
                    }
                    S.md5Revealed = false;
                    S.md5WaitingReveal = false;
                    if (S.pendingNextMd5) {
                        S.md5tx = S.pendingNextMd5;
                        S.currentRoundMd5 = S.pendingNextMd5;
                        S.pendingNextMd5 = '';
                    }
                    if (S.pendingUserRed !== null && S.pendingUserRed !== undefined) {
                        var targetR = S.pendingUserRed;
                        S.pendingUserRed = null;
                        syncUserBalances({red: targetR});
                    }
                    if (this.xnAnimation[0] && this.xnAnimation[0].node.active) {
                        this.setDice(false, false);
                        this.reset();
                    }
                    this.efStop();
                    this.nodeTimeWait.active = this.nodeKetQua.active = this.diaNan.active = false;
                    this.timeCuoc.node.active = this.spriteNan.node.active = true;
                    if (st.time_remain > 0) {
                        var tc = Helper.numberPad(st.time_remain - 1, 2);
                        this.timeCuoc.string = +tc;
                        this.timeCuoc.node.color = st.time_remain <= 6 ? cc.color(255, 69, 69, 255) : cc.Color.WHITE;
                        if (st.time_remain === 6 && !this._stopBetAnnounced) {
                            this._stopBetAnnounced = true;
                            showTableNotice(this, 'Ngừng đặt cược !');
                        }
                    } else {
                        clearInterval(this.timeInterval);
                    }
                }
                st.time_remain--;
                refreshMd5Row();
            }.bind(this), 1000);
        };
        md5Main.nextRealTime = function () {
            if (st.time_remain > 46) {
                this.setDice(true);
                this.nodeTimeWait.active = true;
                this.timeCuoc.node.active = false;
                var t = Helper.numberPad(st.time_remain - 46, 2);
                this.timeWait.string = +t;
            } else {
                this.nodeTimeWait.active = false;
                this.timeCuoc.node.active = true;
                if (st.time_remain > 0) {
                    var tc = Helper.numberPad(st.time_remain - 1, 2);
                    this.timeCuoc.string = +tc;
                    this.timeCuoc.node.color = st.time_remain <= 6 ? cc.color(255, 69, 69, 255) : cc.Color.WHITE;
                }
            }
        };
        md5Main.dataLogs = function () {
            if (!st.logs || !st.logs.length) return;
            var self = this;
            this.dotLogs.forEach(function (e, i) {
                var n = st.logs[i];
                if (void 0 !== n) {
                    var sum = n.dice[0] + n.dice[1] + n.dice[2];
                    e.node.active = true;
                    e.node.phien = n.phien;
                    e.mod.text.string = n.dice[0] + '-' + n.dice[1] + '-' + n.dice[2];
                    e.spriteFrame = sum < 11 ? self.dot_white : self.dot_black;
                } else {
                    e.node.active = false;
                }
            });
            var e = [], i = [], n = [], o = [], c = -1, s = [], a = [], h = 0, r = 0;
            var d = st.logs.slice(0, 19);
            d.reverse();
            for (var u = 0; u < d.length; u++) {
                if (void 0 !== d[u]) {
                    self.RedT.TX_ThongKe.lineAc(u, true);
                    var l = d[u].dice[0], p = d[u].dice[1], g = d[u].dice[2], m = l + p + g;
                    e[u] = {x: 28 * u, y: 28 * l - 28, dice: l};
                    i[u] = {x: 28 * u, y: 28 * p - 28, dice: p};
                    n[u] = {x: 28 * u, y: 28 * g - 28, dice: g};
                    o[u] = {x: 27.7 * u, y: 9.233 * m - 27.7, tong: m};
                } else {
                    self.RedT.TX_ThongKe.lineAc(u, false);
                }
            }
            self.RedT.TX_ThongKe.draw(self.RedT.TX_ThongKe.dice1_line, self.RedT.TX_ThongKe.dice1_dots, e);
            self.RedT.TX_ThongKe.draw(self.RedT.TX_ThongKe.dice2_line, self.RedT.TX_ThongKe.dice2_dots, i);
            self.RedT.TX_ThongKe.draw(self.RedT.TX_ThongKe.dice3_line, self.RedT.TX_ThongKe.dice3_dots, n);
            self.RedT.TX_ThongKe.draw_Tong(self.RedT.TX_ThongKe.tong_line, o);

            var f = Promise.all(this.RedT.TX_ThongKe.KetQuaDot.map(function (el, idx) {
                var item = st.logs[idx];
                if (void 0 !== item) {
                    el.node.active = true;
                    var sum = item.dice[0] + item.dice[1] + item.dice[2];
                    el.spriteFrame = sum < 11 ? self.dot_white : self.dot_black;
                    return sum > 10 ? 1 : 0;
                }
                el.node.active = false;
                return -1;
            }));
            var v = new Promise(function (resolve) {
                var arr = st.logs.slice();
                arr.reverse();
                for (var k = 0; k < arr.length; k++) {
                    var uItem = arr[k];
                    var sum = uItem.dice[0] + uItem.dice[1] + uItem.dice[2];
                    var side = sum > 10 ? 1 : 0;
                    if (c === -1) c = side;
                    if (side !== c || a.length > 4) {
                        c = side;
                        s.push(a);
                        a = [];
                    }
                    if (side === c) a.push(sum);
                }
                s.push(a);
                resolve(s);
            });
            Promise.all([f, v]).then(function (res) {
                var cols = res[1];
                cols.reverse();
                cols = cols.slice(0, 20);
                cols.reverse();
                self.RedT.TX_ThongKe.KetQuaLeft.string = res[0].filter(function (x) { return x == 1; }).length;
                self.RedT.TX_ThongKe.KetQuaRight.string = res[0].filter(function (x) { return x == 0; }).length;
                Promise.all(self.RedT.TX_ThongKe.DiemSoCel.map(function (colNode, colIdx) {
                    var colData = cols[colIdx];
                    if (void 0 !== colData) {
                        colNode.active = true;
                        return Promise.all(colNode.RedT.map(function (cell, cellIdx) {
                            var val = colData[cellIdx];
                            if (void 0 !== val) {
                                var isTai = val > 10;
                                h = isTai ? h + 1 : h;
                                r = isTai ? r : r + 1;
                                cell.node.active = true;
                                cell.node.color = isTai ? cc.color().fromHEX('#B3A1A1') : cc.Color.WHITE;
                                cell.text.string = val;
                                cell.text.node.color = isTai ? cc.Color.WHITE : cc.Color.BLACK;
                                cell.spriteFrame = isTai ? self.dot_black : self.dot_white;
                            } else {
                                cell.node.active = false;
                            }
                        }));
                    }
                    colNode.active = false;
                })).then(function () {
                    self.RedT.TX_ThongKe.DiemSoLeft.string = h;
                    self.RedT.TX_ThongKe.DiemSoRight.string = r;
                });
            });
        };
        md5Main.reset = function () {
            this.efTaiColor.active = false;
            this.efXiuColor.active = false;
            this.setPhien();
            if (this.isNan) this.dataLogs();
            this._currentDices = null;
            this._floatingShown = false;
            S.md5WaitingReveal = false;
            st.data.taixiu.red_me_tai = st.data.taixiu.red_me_xiu = st.data.taixiu.red_player_tai = st.data.taixiu.red_player_xiu = st.data.taixiu.red_tai = st.data.taixiu.red_xiu = this.totalLeft.string = this.totalRight.string = this.myLeft.string = this.myRight.string = this.playerLeft.string = this.playerRight.string = 0;
            updateLobbyMD5Totals({red_tai: 0, red_xiu: 0});
        };
        md5Main.setDefautl = function () {
            st.getLogs = false;
            if (void 0 !== this.timeInterval) clearInterval(this.timeInterval);
            clearTimeout(this.regTimeOut);
            clearTimeout(this.regTimeOut2);
            this.TX_Chat.reset();
        };
        md5Main.status = function (t) {
            if (void 0 !== t) {
                this._results = t;
                if (S.md5Revealed) {
                    showMD5FloatingResult(this, t);
                }
            } else if (this._results) {
                showMD5FloatingResult(this, this._results);
            }
        };

        // Giữ nguyên kích thước chuẩn (scale = 1) cho cả 2 bàn Tài Xỉu và các minigame, không bao giờ thu nhỏ về 0.7
        miniPanel.setTop = function (t) {
            if (t) {
                t.stopAllActions();
                t.scale = 1;
                t.runScale = false;
            }
            if (this.minigame && this.minigame.children) {
                this.minigame.children.forEach(function (e) {
                    if (e && e.active) {
                        e.stopAllActions();
                        e.scale = 1;
                        e.runScale = false;
                    }
                });
            }
        };
        if (miniPanel.TaiXiu && miniPanel.TaiXiu.TX_Main && miniPanel.TaiXiu.TX_Main.xnEffect) {
            miniPanel.TaiXiu.TX_Main.xnEffect.node.active = false;
        }

        // ---- Override TaiXiu (chỉ trên instance MD5) ----
        md5Tx.init = function (t) {
            this.RedT = t;
            this.node.runScale = false;
            this.TX_LichSu = t.Dialog.TaiXiuLichSu;
            this.TX_Top = t.Dialog.TaiXiuTop;
            this.TX_HuTX = t.Dialog.TaiXiuTopHu;
            this.TX_LichSuPhien = t.Dialog.TaiXiuLichSuPhien;
            this.TX_Main.init(this);
            this.TX_ThongKe.init(this);
        };
        md5Tx.regEvent = function (view) {
            cc.RedT.send({taixiumd5: view ? {view: true, getLogs: true} : {view: false}});
        };
        md5Tx.setTop = function () {
            st.scale = 1;
            this.node.scale = 1;
            this.node.parent.insertChild(this.node);
            this.RedT.setTop(this.node);
        };
        md5Tx.openGame = function () {
            cc.RedT.audio.playClick();
            this.notice.active = true;
            if (cc.RedT.IS_LOGIN) {
                // Nếu bàn Tài Xỉu thường cũng đang mở và 2 bàn trùng vị trí -> tách vị trí ra để thấy rõ cả 2 bàn
                try {
                    var origTx = miniPanel.TaiXiu;
                    if (origTx && origTx.node.active) {
                        var dx = Math.abs(this.TX_Main.node.x - origTx.TX_Main.node.x);
                        var dy = Math.abs(this.TX_Main.node.y - origTx.TX_Main.node.y);
                        if (dx < 80 && dy < 80) {
                            origTx.TX_Main.node.position = cc.v2(-200, 75);
                            this.TX_Main.node.position = cc.v2(190, -65);
                            st.position = this.TX_Main.node.position;
                        }
                    }
                } catch (e) {}
                this.node.active = true;
                localStorage.setItem('taixiumd5', true);
                this.setTop();
                this.regEvent(true);
                refreshMd5Row();
            } else {
                cc.RedT.inGame.dialog.showSignIn();
            }
        };
        md5Tx.closeGame = function () {
            cc.RedT.audio.playUnClick();
            this.notice.active = false;
            this.node.active = this.TX_ThongKe.node.active = this.TX_Main.TX_Board.node.active = false;
            localStorage.setItem('taixiumd5', false);
            this.regEvent(false);
            this.inputR1.active = true;
            this.inputL1.active = true;
            this.inputR2.active = false;
            this.inputL2.active = false;
        };
        md5Tx.newGame = function () {
            this.TX_ThongKe.node.active = this.TX_Main.TX_Board.node.active = false;
            this.TX_Main.setDefautl();
        };
        md5Tx.signIn = function () {
            if (this.node && this.node.active) {
                this.regEvent(true);
            }
        };

        // Khởi tạo md5Tx
        md5Tx.init(miniPanel);
        styleMD5Board(md5Tx);
        hookDialogs(miniPanel);
        wireMD5Buttons(md5Tx, miniPanel);
        refreshMd5Row();
    }

    // ------------------------------------------------------------------ thêm icon TÀI XỈU MD5 vào vòng xoay MiniGame
    function buildMD5WheelSpriteFrame(origSf) {
        if (!origSf || !origSf.getTexture()) return Promise.resolve(null);
        var tex = origSf.getTexture(), rc = origSf.getRect(), rot = origSf.isRotated();
        return loadImg(tex.url).then(function (im) {
            if (!im) return null;
            var sw = Math.max(1, (rot ? rc.height : rc.width) | 0);
            var sh = Math.max(1, (rot ? rc.width : rc.height) | 0);

            // Nếu frame trong atlas bị xoay 90 độ, xoay lại về chiều đứng (w x h) trước khi xử lý
            var w = rc.width | 0, h = rc.height | 0;
            var rawCv = document.createElement('canvas');
            rawCv.width = sw; rawCv.height = sh;
            rawCv.getContext('2d').drawImage(im, rc.x, rc.y, sw, sh, 0, 0, sw, sh);

            var cv = document.createElement('canvas');
            cv.width = w;
            cv.height = h + 16;
            var cx = cv.getContext('2d');
            if (rot) {
                cx.save();
                cx.translate(0, h);
                cx.rotate(-Math.PI / 2);
                cx.drawImage(rawCv, 0, 0);
                cx.restore();
            } else {
                cx.drawImage(rawCv, 0, 0);
            }

            // Đổi màu 2 viên xúc xắc trắng ở phần trên (y < h - 22) sang xúc xắc đỏ chấm trắng
            var diceH = Math.max(1, h - 22);
            var imgData = cx.getImageData(0, 0, w, diceH);
            var d = imgData.data;
            for (var i = 0; i < d.length; i += 4) {
                var a = d[i + 3];
                if (a < 25) continue;
                var r = d[i], g = d[i + 1], b = d[i + 2];
                var lum = 0.299 * r + 0.587 * g + 0.114 * b;
                if (lum < 85) {
                    // Chấm đen của xúc xắc -> chấm trắng sáng
                    d[i] = 255; d[i + 1] = 248; d[i + 2] = 240;
                } else {
                    // Thân xúc xắc trắng/xám -> đỏ tươi có chiều sâu
                    var k = lum / 255;
                    d[i]     = Math.min(255, Math.round(145 + k * 110));
                    d[i + 1] = Math.round(k * k * 42);
                    d[i + 2] = Math.round(k * k * 48);
                }
            }
            cx.putImageData(imgData, 0, 0);

            // Vẽ dòng chữ "MD5" vàng viền nâu đỏ nổi bật ngay dưới chữ "TÀI XỈU"
            cx.save();
            cx.font = '900 15px Arial, sans-serif';
            cx.textAlign = 'center';
            cx.textBaseline = 'middle';
            cx.lineWidth = 4;
            cx.strokeStyle = '#3a0808';
            cx.strokeText('MD5', w / 2, h + 6);
            var grad = cx.createLinearGradient(0, h - 2, 0, h + 14);
            grad.addColorStop(0, '#fff6a9');
            grad.addColorStop(0.5, '#ffd438');
            grad.addColorStop(1, '#e68a00');
            cx.fillStyle = grad;
            cx.fillText('MD5', w / 2, h + 6);
            cx.restore();

            var newTex = new cc.Texture2D();
            newTex.initWithElement(cv);
            newTex.handleLoadedTexture();
            newTex._packable = false;
            return new cc.SpriteFrame(newTex);
        }).catch(function (e) { warn(e); return null; });
    }

    function addMiniGameWheelIcon() {
        try {
            var rootNode = (S.miniPanel && S.miniPanel.node) || (cc.RedT && cc.RedT.MiniPanel && cc.RedT.MiniPanel.node);
            var bg = (rootNode && cc.find('popup/minigame/bg', rootNode)) || cc.find('Canvas/RedHat/popup/minigame/bg');
            if (!bg) return false;
            if (bg.getChildByName('iconTaiXiuMD5')) {
                S.wheelAdded = true;
                return true;
            }
            var iconTX = bg.getChildByName('iconTaiXiu');
            if (!iconTX) return false;

            var md5Icon = cc.instantiate(iconTX);
            md5Icon.name = 'iconTaiXiuMD5';

            // Xóa clickEvents cũ (mở bàn thường) và gắn click mở bàn MD5 + đóng vòng xoay
            var btn = md5Icon.getComponent(cc.Button);
            if (btn) btn.clickEvents = [];
            md5Icon.on('click', function () {
                window.MD5Mode.open();
                try {
                    var popupComp = bg.parent.getComponent('popupMinigame');
                    if (popupComp && popupComp.list && popupComp.list.active) popupComp.toggle();
                } catch (e) {}
            });

            // Đặt iconTaiXiuMD5 ngay sau iconTaiXiu và xếp đều 7 icon quanh vòng tròn R = 130, tâm Y = 6
            bg.insertChild(md5Icon, iconTX.getSiblingIndex() + 1);
            var kids = bg.children;
            var n = kids.length;
            var radius = 130;
            for (var i = 0; i < n; i++) {
                // Bắt đầu từ góc 180 độ (bên trái: TÀI XỈU), đi ngược chiều kim đồng hồ
                var deg = 180 + (360 / n) * i;
                var rad = deg * Math.PI / 180;
                kids[i].setPosition(Math.round(radius * Math.cos(rad)), Math.round(6 + radius * Math.sin(rad)));
            }

            var sp = md5Icon.getComponent(cc.Sprite);
            if (sp && sp.spriteFrame) {
                buildMD5WheelSpriteFrame(sp.spriteFrame).then(function (nf) {
                    if (nf && sp.isValid) {
                        sp.sizeMode = cc.Sprite.SizeMode.RAW;
                        sp.spriteFrame = nf;
                        md5Icon.width = nf.getRect().width;
                        md5Icon.height = nf.getRect().height;
                    }
                });
            }

            S.wheelAdded = true;
            return true;
        } catch (e) {
            warn(e);
            return false;
        }
    }

    // ------------------------------------------------------------------ Ẩn các game đang bảo trì / Coming Soon khỏi sảnh
    function hideMaintenanceLobbyGames() {
        try {
            var menuGame = cc.find('Canvas/Main/Menu/MenuGame') || cc.find('Canvas/Menu/MenuGame');
            if (!menuGame) {
                var scene = cc.director.getScene();
                if (scene) {
                    (function findMG(n) {
                        if (!n || menuGame) return;
                        if (n.name === 'MenuGame') { menuGame = n; return; }
                        for (var i = 0; i < n.children.length; i++) findMG(n.children[i]);
                    })(scene);
                }
            }
            if (!menuGame) return false;

            ['scrollAll', 'Gamebai', 'Slot', 'Quayso'].forEach(function (tabName) {
                var tab = menuGame.getChildByName(tabName);
                var content = tab && cc.find('view/content', tab);
                if (!content) return;

                // Nếu trong scrollAll có icon-Pubg nằm chung với othethao (bảo trì), chuyển icon-Pubg sang MiniGame-01 (cùng cột với 3 Cây)
                var mg01 = content.getChildByName('MiniGame-01');
                content.children.forEach(function (card) {
                    if (!card || !card.active) return;
                    if (card.width < 30 && (card.name === '1' || card.name === '1 copy')) {
                        card.active = false;
                        return;
                    }
                    if (card.name === 'MiniGame-03') {
                        var candyParent = card.getChildByName('icon-Candy');
                        if (candyParent) {
                            var kc = candyParent.getChildByName('kc');
                            var cd = candyParent.getChildByName('Candy');
                            if (kc) kc.active = false;
                            if (cd) cd.active = true;
                        }
                    }
                    var pubgNode = card.getChildByName('icon-Pubg');
                    var othethao = cc.find('Mini-poker/othethao', card);
                    if (pubgNode && othethao && mg01) {
                        pubgNode.parent = mg01;
                        var l01 = mg01.getComponent(cc.Layout);
                        if (l01) l01.updateLayout();
                    }

                    // Kiểm tra xem card hoặc các nút con của card có gọi onWait (bảo trì) hay không
                    var hasPlayable = false;
                    var hasWait = false;
                    (function checkBtns(n) {
                        if (!n || n.active === false) return;
                        var btn = n.getComponent(cc.Button);
                        if (btn && btn.clickEvents && btn.clickEvents.length) {
                            btn.clickEvents.forEach(function (ev) {
                                if (!ev || !ev.handler || ev.handler === 'audioClick') return;
                                if (ev.handler === 'onWait' || ev.customEventData === 'Comingsoon') {
                                    hasWait = true;
                                } else {
                                    hasPlayable = true;
                                }
                            });
                        }
                        for (var i = 0; i < n.children.length; i++) checkBtns(n.children[i]);
                    })(card);

                    if (hasWait && !hasPlayable) {
                        card.active = false;
                    }
                });

                var layout = content.getComponent(cc.Layout);
                if (layout) layout.updateLayout();
            });
            fixBitmapFontsInMemory();
            return true;
        } catch (e) {
            return false;
        }
    }

    var _fontsFixed = false;
    var _fontExportNaturalXa = {
        '236': 18, '237': 18, '296': 26, '431': 38, '7844': 39, '7845': 33,
        '7848': 38, '7849': 33, '7870': 34, '7871': 33, '7874': 33, '7875': 33,
        '7888': 39, '7889': 34, '7892': 38, '7893': 34, '7912': 38, '7914': 38,
        '7916': 38, '7918': 38, '7920': 38
    };
    function fixBitmapFontsInMemory() {
        try {
            if (!window.cc || !cc.loader || !cc.loader._cache) return;
            var cache = cc.loader._cache;
            for (var k in cache) {
                var item = cache[k];
                var content = item && item.content;
                if (content && content instanceof cc.BitmapFont && content._fntConfig && content._name === 'Font-export') {
                    var dict = content._fntConfig.fontDefDictionary;
                    if (dict) {
                        for (var chCode in _fontExportNaturalXa) {
                            if (dict[chCode]) dict[chCode].xAdvance = _fontExportNaturalXa[chCode];
                        }
                        if (!dict['61'] && dict['45']) {
                            dict['61'] = JSON.parse(JSON.stringify(dict['45']));
                        }
                    }
                    if (content._fontDefDictionary && content._fontDefDictionary._letterDefinitions) {
                        var ldefs = content._fontDefDictionary._letterDefinitions;
                        for (var lk in _fontExportNaturalXa) {
                            if (ldefs[lk]) ldefs[lk].xAdvance = _fontExportNaturalXa[lk];
                        }
                    }
                }
            }
            if (!_fontsFixed && cc.RedT && cc.RedT.inGame && cc.RedT.inGame.dialog && cc.RedT.inGame.dialog.node) {
                _fontsFixed = true;
                (function fixDialogLabels(n) {
                    if (!n) return;
                    var lbl = n.getComponent && n.getComponent(cc.Label);
                    if (lbl && lbl.font && lbl.font instanceof cc.BitmapFont) {
                        var fname = lbl.font._name || '';
                        var str = lbl.string || '';
                        if (fname === 'Font-export' && (str.indexOf('\n') !== -1 || str.length > 26)) {
                            if (str.slice(-1) === '\n') lbl.string = str.slice(0, -1);
                            if (lbl.lineHeight < 60) lbl.lineHeight = 62;
                        } else if (fname === 'roboto-regular' && (str.indexOf('\n') !== -1 || str.length > 30)) {
                            if (lbl.lineHeight < 48) lbl.lineHeight = 50;
                        }
                        if (lbl._forceUpdateRenderData) lbl._forceUpdateRenderData();
                    }
                    if (n.children) {
                        for (var i = 0; i < n.children.length; i++) fixDialogLabels(n.children[i]);
                    }
                })(cc.RedT.inGame.dialog.node);
            }
        } catch (e) {}
    }

    function numberWithCommas(n) {
        if (n === undefined || n === null) return '0';
        var num = Math.floor(Number(n) || 0);
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    function syncUserBalances(u) {
        try {
            if (!u || !window.cc || !cc.RedT) return;
            if (cc.RedT.user) {
                if (u.red !== undefined) cc.RedT.user.red = u.red;
                if (u.ketSat !== undefined) cc.RedT.user.ketSat = u.ketSat;
                if (u.xu !== undefined) cc.RedT.user.xu = u.xu;
            }
            var ig = cc.RedT.inGame;
            if (!ig) return;
            if (typeof ig.userData === 'function' && cc.RedT.user) {
                try { ig.userData(cc.RedT.user); } catch (e) {}
            }
            if (u.red !== undefined && ig.header && ig.header.userRed) {
                ig.header.userRed.string = numberWithCommas(u.red);
            }
            if (ig.dialog) {
                if (ig.dialog.KetSat) {
                    if (u.red !== undefined && ig.dialog.KetSat.redHT) {
                        ig.dialog.KetSat.redHT.string = numberWithCommas(u.red);
                    }
                    if (u.ketSat !== undefined && ig.dialog.KetSat.redKet) {
                        ig.dialog.KetSat.redKet.string = numberWithCommas(u.ketSat);
                    }
                }
                if (ig.dialog.profile && ig.dialog.profile.CaNhan) {
                    if (u.red !== undefined && ig.dialog.profile.CaNhan.Balance) {
                        ig.dialog.profile.CaNhan.Balance.string = numberWithCommas(u.red);
                    }
                    if (u.ketSat !== undefined && ig.dialog.profile.CaNhan.Balanceket) {
                        ig.dialog.profile.CaNhan.Balanceket.string = numberWithCommas(u.ketSat);
                    }
                }
            }
        } catch (e) {}
    }

    function getLobbyMD5Labels() {
        try {
            if (S.lobbyTaiLbl && S.lobbyTaiLbl.isValid && S.lobbyXiuLbl && S.lobbyXiuLbl.isValid) {
                return {tai: S.lobbyTaiLbl, xiu: S.lobbyXiuLbl};
            }
            var menuGame = cc.find('Canvas/Main/Menu/MenuGame') || cc.find('Canvas/Menu/MenuGame');
            if (!menuGame) {
                var scene = cc.director.getScene();
                if (scene) {
                    (function findMG(n) {
                        if (!n || menuGame) return;
                        if (n.name === 'MenuGame') { menuGame = n; return; }
                        for (var i = 0; i < n.children.length; i++) findMG(n.children[i]);
                    })(scene);
                }
            }
            if (!menuGame) return null;
            var nd5Icon = cc.find('scrollAll/view/content/nd5/icon', menuGame);
            if (!nd5Icon) return null;
            var taiNode = nd5Icon.getChildByName('tai');
            var xiuNode = nd5Icon.getChildByName('xiu');
            S.lobbyTaiLbl = taiNode && taiNode.getComponent(cc.Label);
            S.lobbyXiuLbl = xiuNode && xiuNode.getComponent(cc.Label);
            if (S.lobbyTaiLbl && S.lobbyXiuLbl) {
                return {tai: S.lobbyTaiLbl, xiu: S.lobbyXiuLbl};
            }
        } catch (e) {}
        return null;
    }

    function updateLobbyMD5Totals(txData) {
        try {
            if (!txData) return;
            var lbls = getLobbyMD5Labels();
            if (!lbls) return;
            var Tween = null;
            try {
                var twMod = window.__require && window.__require('Tween');
                Tween = (twMod && twMod.default) || twMod;
            } catch (e) {}
            if (txData.red_tai !== undefined && lbls.tai) {
                if (txData.red_tai > 0) {
                    if (Tween && Tween.numberTo) {
                        Tween.numberTo(lbls.tai, txData.red_tai, 0.3);
                    } else {
                        lbls.tai.string = numberWithCommas(txData.red_tai);
                    }
                } else if (!lbls.tai.string || (S.main && S.main.time_remain === 45)) {
                    lbls.tai.string = '0';
                }
            }
            if (txData.red_xiu !== undefined && lbls.xiu) {
                if (txData.red_xiu > 0) {
                    if (Tween && Tween.numberTo) {
                        Tween.numberTo(lbls.xiu, txData.red_xiu, 0.3);
                    } else {
                        lbls.xiu.string = numberWithCommas(txData.red_xiu);
                    }
                } else if (!lbls.xiu.string || (S.main && S.main.time_remain === 45)) {
                    lbls.xiu.string = '0';
                }
            }
        } catch (e) {}
    }

    // ------------------------------------------------------------------ Helper vẽ Canvas 2D sắc nét lên cc.Sprite
    function drawRoundRect(cx, x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        cx.beginPath();
        cx.moveTo(x + r, y);
        cx.arcTo(x + w, y, x + w, y + h, r);
        cx.arcTo(x + w, y + h, x, y + h, r);
        cx.arcTo(x, y + h, x, y, r);
        cx.arcTo(x, y, x + w, y, r);
        cx.closePath();
    }

    function setCanvasSprite(node, w, h, drawFn) {
        if (!node || !node.isValid) return;
        var sp = node.getComponent(cc.Sprite) || node.addComponent(cc.Sprite);
        var cv = document.createElement('canvas');
        var dpr = 2;
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
        var cx = cv.getContext('2d');
        cx.scale(dpr, dpr);
        drawFn(cx, w, h);
        var tex = new cc.Texture2D();
        tex.initWithElement(cv);
        tex.handleLoadedTexture();
        tex._packable = false;
        var sf = new cc.SpriteFrame(tex);
        sp.sizeMode = cc.Sprite.SizeMode.CUSTOM;
        sp.spriteFrame = sf;
        node.width = w;
        node.height = h;
    }

    // ------------------------------------------------------------------ 1. Tab MENU Sảnh Chính (Tắt nhạc nền, Tắt tiếng, CSKH)
    var _audioHooked = false;
    function isBgMusicOn() {
        try {
            var v = localStorage.getItem('SOUND_BACKGROUND');
            if (v === null) return true;
            return v === 'true' || v === '1' || JSON.parse(v) === true;
        } catch (e) {
            return true;
        }
    }

    function showTableNotice(main, text) {
        if (!main || !main.node || !main.node.active || !text) return;
        try {
            if (main._lastNoticeText === text && Date.now() - (main._lastNoticeTime || 0) < 1500) {
                return;
            }
            main._lastNoticeText = text;
            main._lastNoticeTime = Date.now();
            var box = main.node.getChildByName('centerNoticeBox');
            if (!box) {
                box = new cc.Node('centerNoticeBox');
                box.position = cc.v2(0, 50.7);
                box.zIndex = 3000;
                main.node.addChild(box);
            }
            var prefab = (main.RedT && main.RedT.RedT && main.RedT.RedT.prefabMiniNotice) ||
                         (cc.RedT && cc.RedT.MiniPanel && cc.RedT.MiniPanel.prefabMiniNotice);
            if (!prefab) return;
            var n = cc.instantiate(prefab);
            var comp = n.getComponent('mini_warning');
            if (comp && comp.text) comp.text.string = text;
            n.position = cc.v2(0, 0);
            box.addChild(n);
        } catch (e) {
            warn(e);
        }
    }

    function showTableFloatingResult(main, t) {
        if (!main || !main.node || !main.node.active || !t) return;
        try {
            var betVal = Number(t.bet) || 0;
            if (betVal <= 0) return;
            var Helper = window.__require('Helper');
            var box = main.node.getChildByName('centerNoticeBox');
            if (!box) {
                box = new cc.Node('centerNoticeBox');
                box.position = cc.v2(0, 50.7);
                box.zIndex = 3000;
                main.node.addChild(box);
            }
            var e = new cc.Node('FloatingResult');
            var lb = e.addComponent(cc.Label);
            lb.string = (t.win ? '+' : '-') + Helper.numberWithCommas(betVal);
            lb.font = t.win ? (main.fontCong || cc.RedT.util.fontCong) : (main.fontTru || cc.RedT.util.fontTru);
            lb.lineHeight = 40;
            lb.fontSize = 34;
            e.position = cc.v2(0, 0);
            e.opacity = 255;
            e.scale = 0.5;
            box.addChild(e);
            e.runAction(cc.sequence(
                cc.spawn(cc.scaleTo(0.15, 1.15), cc.fadeIn(0.15)),
                cc.scaleTo(0.1, 1.0),
                cc.delayTime(0.8),
                cc.spawn(
                    cc.moveTo(1.8, cc.v2(0, 75)),
                    cc.fadeOut(1.8)
                ),
                cc.callFunc(function () { this.destroy(); }, e)
            ));
        } catch (err) {
            warn(err);
        }
    }

    function isGameSoundOn() {
        try {
            if (cc.RedT && typeof cc.RedT.IS_SOUND === 'boolean') return cc.RedT.IS_SOUND;
            var v = localStorage.getItem('SOUND_GAME');
            if (v === null) return true;
            return v === 'true' || v === '1' || JSON.parse(v) === true;
        } catch (e) {
            return true;
        }
    }

    function applyAudioStates() {
        try {
            if (!window.cc || !cc.RedT) return;
            var bgOn = isBgMusicOn();
            var sfxOn = isGameSoundOn();
            cc.RedT.IS_SOUND = sfxOn;
            if (cc.RedT.audio && cc.RedT.audio.bg) {
                try {
                    if (bgOn) {
                        if (!cc.RedT.audio.bg.isPlaying) cc.RedT.audio.bg.play();
                    } else {
                        cc.RedT.audio.bg.stop();
                    }
                } catch (e) {}
            }
            if (cc.audioEngine && cc.audioEngine.setEffectsVolume) {
                try { cc.audioEngine.setEffectsVolume(sfxOn ? 1 : 0); } catch (e) {}
            }
            if (cc.RedT.inGame && cc.RedT.inGame.dialog && cc.RedT.inGame.dialog.settings) {
                var stDlg = cc.RedT.inGame.dialog.settings;
                if (stDlg.NhacNen && stDlg.NhacNen.isChecked !== bgOn) {
                    stDlg.NhacNen.isChecked = bgOn;
                    if (stDlg.NhacNen.OnUpdate) stDlg.NhacNen.OnUpdate();
                }
                if (stDlg.NhacGame && stDlg.NhacGame.isChecked !== sfxOn) {
                    stDlg.NhacGame.isChecked = sfxOn;
                    if (stDlg.NhacGame.OnUpdate) stDlg.NhacGame.OnUpdate();
                }
            }
            refreshLobbyMenuUI();
        } catch (e) {}
    }

    function toggleBgMusic() {
        try {
            var next = !isBgMusicOn();
            if (cc.RedT && cc.RedT.setSoundBackground) cc.RedT.setSoundBackground(next);
            else localStorage.setItem('SOUND_BACKGROUND', JSON.stringify(next));
            applyAudioStates();
        } catch (e) {}
    }

    function toggleGameSound() {
        try {
            var next = !isGameSoundOn();
            if (cc.RedT && cc.RedT.setSoundGame) cc.RedT.setSoundGame(next);
            else localStorage.setItem('SOUND_GAME', JSON.stringify(next));
            if (cc.RedT) cc.RedT.IS_SOUND = next;
            if (!next) {
                try {
                    if (cc.RedT && cc.RedT.MiniPanel && cc.RedT.MiniPanel.TaiXiu && cc.RedT.MiniPanel.TaiXiu.TX_Main) {
                        var m = cc.RedT.MiniPanel.TaiXiu.TX_Main;
                        if (m.audioWin) m.audioWin.stop();
                        if (m.xnAnimation && m.xnAnimation[0]) {
                            var as = m.xnAnimation[0].node.getComponent(cc.AudioSource);
                            if (as) as.stop();
                        }
                    }
                } catch (e) {}
            } else if (cc.RedT && cc.RedT.audio && cc.RedT.audio.playClick) {
                try { cc.RedT.audio.playClick(); } catch (e) {}
            }
            applyAudioStates();
        } catch (e) {}
    }

    function refreshLobbyMenuUI() {
        try {
            var bgOn = isBgMusicOn();
            var sfxOn = isGameSoundOn();
            var stComp = cc.RedT && cc.RedT.inGame && cc.RedT.inGame.dialog && cc.RedT.inGame.dialog.settings;
            var bgOnFrame = stComp && stComp.NhacNen && stComp.NhacNen.BgOn;
            var bgOffFrame = stComp && stComp.NhacNen && stComp.NhacNen.BgOff;
            var sfxOnFrame = (stComp && stComp.NhacGame && stComp.NhacGame.BgOn) || bgOnFrame;
            var sfxOffFrame = (stComp && stComp.NhacGame && stComp.NhacGame.BgOff) || bgOffFrame;

            if (S.menuBgSwitchSp && S.menuBgSwitchSp.isValid && bgOnFrame && bgOffFrame) {
                S.menuBgSwitchSp.spriteFrame = bgOn ? bgOnFrame : bgOffFrame;
            }
            if (S.menuSfxSwitchSp && S.menuSfxSwitchSp.isValid && sfxOnFrame && sfxOffFrame) {
                S.menuSfxSwitchSp.spriteFrame = sfxOn ? sfxOnFrame : sfxOffFrame;
            }
        } catch (e) {}
    }

    function wireSetting1CskhDialog() {
        try {
            var st1 = cc.find('Canvas/dialog/setting1') || (cc.RedT && cc.RedT.inGame && cc.RedT.inGame.dialog && cc.RedT.inGame.dialog.settings1 && cc.RedT.inGame.dialog.settings1.node);
            if (!st1) return;

            // Đưa bảng CSKH ra chính giữa màn hình với khung chuẩn của web, dễ nhìn, không bị lệch góc
            st1.setPosition(0, 0);
            st1.setScale(1, 1);

            var titleBar = st1.getChildByName('lb_popup_title_bg_1');
            if (titleBar) {
                titleBar.active = true;
                titleBar.setPosition(0, 148);
                var titleLblNode = titleBar.getChildByName('Tittle');
                var titleLbl = titleLblNode && titleLblNode.getComponent(cc.Label);
                if (titleLbl) {
                    titleLbl.string = 'HỖ TRỢ CSKH';
                    titleLbl.fontSize = 26;
                }
            }

            var bg2 = st1.getChildByName('dialog_bg2');
            if (bg2) {
                bg2.setPosition(0, 0);
                bg2.setScale(1, 1);
                bg2.width = 480;
                bg2.height = 340;

                var lc = bg2.getChildByName('livechat');
                var g1 = bg2.getChildByName('gach');
                var tg = bg2.getChildByName('hotline');
                var g2 = bg2.getChildByName('gach copy');
                var ms = bg2.getChildByName('mes');

                if (lc) { lc.setPosition(0, 66); lc.width = 140; lc.height = 40; lc.setScale(1.38, 1.38); }
                if (g1) { g1.setPosition(0, 20); g1.width = 330; g1.height = 4; }
                if (tg) { tg.setPosition(0, -24); tg.width = 40; tg.height = 140; tg.setScale(1.38, 1.38); }
                if (g2) { g2.setPosition(0, -68); g2.width = 330; g2.height = 4; }
                if (ms) { ms.setPosition(0, -112); ms.width = 140; ms.height = 40; ms.setScale(1.38, 1.38); }

                if (!st1._cskhWired) {
                    st1._cskhWired = true;
                    [
                        {node: lc, title: 'LIVECHAT CSKH', url: '/fanpage/', msg: 'Đang kết nối kênh LiveChat Chăm Sóc Khách Hàng 24/7...'},
                        {node: tg, title: 'TELEGRAM CSKH', url: '/telegram/', msg: 'Đang kết nối kênh Telegram Chăm Sóc Khách Hàng 24/7...'},
                        {node: ms, title: 'MESSENGER CSKH', url: '/fanpage/', msg: 'Đang kết nối kênh Messenger Chăm Sóc Khách Hàng 24/7...'}
                    ].forEach(function (cfg) {
                        if (!cfg.node) return;
                        var b = cfg.node.getComponent(cc.Button);
                        if (b) b.clickEvents = [];
                        cfg.node.off(cc.Node.EventType.TOUCH_END);
                        cfg.node.on(cc.Node.EventType.TOUCH_END, function (ev) {
                            if (ev && ev.stopPropagation) ev.stopPropagation();
                            if (cc.RedT && cc.RedT.audio && cc.RedT.audio.playClick) cc.RedT.audio.playClick();
                            if (cc.RedT && cc.RedT.inGame && cc.RedT.inGame.dialog) {
                                cc.RedT.inGame.dialog.onCloseDialog();
                            }
                            if (cc.RedT && cc.RedT.inGame && cc.RedT.inGame.notice) {
                                cc.RedT.inGame.notice.show({title: cfg.title, text: cfg.msg});
                            }
                        });
                    });
                }
            }
            var closeBtn = st1.getChildByName('close');
            if (closeBtn) {
                closeBtn.setPosition(224, 168);
                closeBtn.setScale(0.85, 0.85);
                closeBtn.off(cc.Node.EventType.TOUCH_END);
                closeBtn.on(cc.Node.EventType.TOUCH_END, function (ev) {
                    if (ev && ev.stopPropagation) ev.stopPropagation();
                    if (cc.RedT && cc.RedT.inGame && cc.RedT.inGame.dialog) {
                        cc.RedT.inGame.dialog.onCloseDialog();
                    } else {
                        st1.active = false;
                    }
                });
            }
        } catch (e) {}
    }

    function setupLobbyMenuAndAudio() {
        try {
            if (!window.cc) return false;
            if (!_audioHooked && cc.AudioSource && cc.AudioSource.prototype) {
                _audioHooked = true;
                var origPlay = cc.AudioSource.prototype.play;
                cc.AudioSource.prototype.play = function () {
                    try {
                        var isBg = (cc.RedT && cc.RedT.audio && cc.RedT.audio.bg === this);
                        if (isBg) {
                            if (!isBgMusicOn()) return;
                        } else {
                            if (!isGameSoundOn()) return;
                        }
                    } catch (e) {}
                    return origPlay.apply(this, arguments);
                };
            }

            // Đảm bảo nút NHIỆM VỤ ở thanh Footer luôn bật và bấm vào mở ngay bảng Nhiệm Vụ
            var nvBtnNode = cc.find('Canvas/Footer88/JackpotIcon_Animation');
            if (nvBtnNode && !nvBtnNode._nvClickFixed) {
                nvBtnNode._nvClickFixed = true;
                var nvBtn = nvBtnNode.getComponent(cc.Button);
                if (nvBtn) {
                    nvBtn.enabled = true;
                    nvBtn.clickEvents = [];
                }
                nvBtnNode.off(cc.Node.EventType.TOUCH_END);
                nvBtnNode.on(cc.Node.EventType.TOUCH_END, function (ev) {
                    if (ev && ev.stopPropagation) ev.stopPropagation();
                    if (cc.RedT && cc.RedT.audio && cc.RedT.audio.playClick) cc.RedT.audio.playClick();
                    if (cc.RedT && cc.RedT.inGame && cc.RedT.inGame.dialog) {
                        cc.RedT.inGame.dialog.ShowNhiemVu();
                    }
                });
            }

            // Hook Settings dialog methods so toggling inside Cài Đặt also updates PanelSupport
            if (cc.RedT && cc.RedT.inGame && cc.RedT.inGame.dialog && cc.RedT.inGame.dialog.settings) {
                var stComp = cc.RedT.inGame.dialog.settings;
                if (!stComp._menuSynced) {
                    stComp._menuSynced = true;
                    var origBg = stComp.OnChangerNhacNen && stComp.OnChangerNhacNen.bind(stComp);
                    stComp.OnChangerNhacNen = function () {
                        if (origBg) origBg();
                        refreshLobbyMenuUI();
                    };
                    var origGame = stComp.OnChangerNhacGame && stComp.OnChangerNhacGame.bind(stComp);
                    stComp.OnChangerNhacGame = function () {
                        if (origGame) origGame();
                        refreshLobbyMenuUI();
                    };
                }
            }

            wireSetting1CskhDialog();

            var licsu = cc.find('Canvas/Footer88/right/licsu');
            if (!licsu) return false;
            var panelSupport = licsu.getChildByName('PanelSupport');
            var icLichsu = licsu.getChildByName('ic_lichsu');
            if (!panelSupport) return false;

            // Tắt cc.Widget trên PanelSupport để không bị đẩy tràn ra ngoài mép phải màn hình
            var psWidget = panelSupport.getComponent(cc.Widget);
            if (psWidget) psWidget.enabled = false;
            panelSupport.setPosition(-145, 198);

            // Sửa nút ic_lichsu (3 gạch) để bấm vào mở đúng PanelSupport thay vì mở thẳng setting1
            if (icLichsu && !icLichsu._menuFixed) {
                icLichsu._menuFixed = true;
                var icBtn = icLichsu.getComponent(cc.Button);
                if (icBtn) icBtn.clickEvents = [];
                icLichsu.off(cc.Node.EventType.TOUCH_END);
                icLichsu.on(cc.Node.EventType.TOUCH_END, function (ev) {
                    if (ev && ev.stopPropagation) ev.stopPropagation();
                    panelSupport.active = !panelSupport.active;
                    if (panelSupport.active) {
                        panelSupport.setPosition(-145, 198);
                        refreshLobbyMenuUI();
                    }
                });
            }
            if (!licsu._menuFixed) {
                licsu._menuFixed = true;
                var lBtn = licsu.getComponent(cc.Button);
                if (lBtn) lBtn.clickEvents = [];
                licsu.off(cc.Node.EventType.TOUCH_END);
                licsu.on(cc.Node.EventType.TOUCH_END, function (ev) {
                    if (ev && ev.target && panelSupport.isChildOf && (ev.target === panelSupport || ev.target.isChildOf(panelSupport))) {
                        return;
                    }
                    panelSupport.active = !panelSupport.active;
                    if (panelSupport.active) {
                        panelSupport.setPosition(-145, 198);
                        refreshLobbyMenuUI();
                    }
                });
            }

            var bg = panelSupport.getChildByName('BG');
            var settingNode = cc.find('Canvas/dialog/setting');
            if (!bg || !settingNode) return false;

            if (!bg.getChildByName('CustomLobbyMenu')) {
                bg.width = 336;
                bg.height = 236;
                var bgSp = bg.getComponent(cc.Sprite);
                if (bgSp) bgSp.enabled = false;
                var htMn = bg.getChildByName('ht_mn');
                if (htMn) htMn.active = false;
                var oldMenu = bg.getChildByName('menu');
                if (oldMenu) oldMenu.active = false;

                var root = new cc.Node('CustomLobbyMenu');
                root.width = 336;
                root.height = 236;
                bg.addChild(root, 10);

                // 1. Dùng đúng khung nền dialog_bg2 chuẩn của Setting web
                var origBg2 = settingNode.getChildByName('dialog_bg2');
                if (origBg2) {
                    var menuFrame = cc.instantiate(origBg2);
                    menuFrame.setPosition(0, 0);
                    menuFrame.width = 336;
                    menuFrame.height = 248;
                    root.addChild(menuFrame, 0);
                }

                // Lấy mẫu chữ Title (font UTM AvoBold) và vạch ngăn cách vàng từ giao diện gốc của web
                var tplTitle = cc.find('New Node/NhacNen/Title', settingNode);
                var tplHeaderLbl = cc.find('lb_popup_title_bg_1/Tittle', settingNode);
                var tplGach = cc.find('Canvas/dialog/setting1/dialog_bg2/gach');
                var stCompRef = cc.RedT && cc.RedT.inGame && cc.RedT.inGame.dialog && cc.RedT.inGame.dialog.settings;

                if (tplHeaderLbl) {
                    var hdr = cc.instantiate(tplHeaderLbl);
                    hdr.active = true;
                    hdr.setPosition(0, 103);
                    var hdrLbl = hdr.getComponent(cc.Label);
                    if (hdrLbl) {
                        hdrLbl.string = 'MENU CÀI ĐẶT';
                        hdrLbl.fontSize = 18;
                        hdrLbl.lineHeight = 22;
                    }
                    root.addChild(hdr, 5);
                }

                function makeNativeLabel(text, x, y, size) {
                    var n = tplTitle ? cc.instantiate(tplTitle) : new cc.Node('Lbl');
                    n.active = true;
                    n.setPosition(x, y);
                    n.anchorX = 0;
                    n.anchorY = 0.5;
                    var lbl = n.getComponent(cc.Label) || n.addComponent(cc.Label);
                    lbl.string = text;
                    lbl.fontSize = size || 19;
                    lbl.lineHeight = (size || 19) + 4;
                    lbl.horizontalAlign = cc.Label.HorizontalAlign.LEFT;
                    return n;
                }

                function makeDivider(y) {
                    if (!tplGach) return;
                    var d = cc.instantiate(tplGach);
                    d.active = true;
                    d.setPosition(0, y);
                    d.width = 288;
                    d.height = 3;
                    root.addChild(d, 2);
                }

                // Hàng 1: NHẠC NỀN + Công tắc ON/OFF chuẩn của Setting web
                var row1 = new cc.Node('RowNhacNen');
                row1.setPosition(0, 54);
                row1.width = 304;
                row1.height = 52;
                row1.addChild(makeNativeLabel('NHẠC NỀN', -138, 0, 19));
                var swNode1 = new cc.Node('SwitchBg');
                swNode1.setPosition(76, 0);
                swNode1.setScale(0.78, 0.78);
                var swSp1 = swNode1.addComponent(cc.Sprite);
                if (stCompRef && stCompRef.NhacNen) {
                    swSp1.spriteFrame = isBgMusicOn() ? stCompRef.NhacNen.BgOn : stCompRef.NhacNen.BgOff;
                }
                row1.addChild(swNode1);
                row1.on(cc.Node.EventType.TOUCH_END, function (ev) {
                    if (ev && ev.stopPropagation) ev.stopPropagation();
                    toggleBgMusic();
                });
                root.addChild(row1, 5);

                makeDivider(22);

                // Hàng 2: HIỆU ỨNG (TẮT TIẾNG) + Công tắc ON/OFF chuẩn của Setting web
                var row2 = new cc.Node('RowTatTieng');
                row2.setPosition(0, -10);
                row2.width = 304;
                row2.height = 52;
                row2.addChild(makeNativeLabel('HIỆU ỨNG', -138, 0, 19));
                var swNode2 = new cc.Node('SwitchSfx');
                swNode2.setPosition(76, 0);
                swNode2.setScale(0.78, 0.78);
                var swSp2 = swNode2.addComponent(cc.Sprite);
                if (stCompRef && stCompRef.NhacGame) {
                    swSp2.spriteFrame = isGameSoundOn() ? stCompRef.NhacGame.BgOn : stCompRef.NhacGame.BgOff;
                }
                row2.addChild(swNode2);
                row2.on(cc.Node.EventType.TOUCH_END, function (ev) {
                    if (ev && ev.stopPropagation) ev.stopPropagation();
                    toggleGameSound();
                });
                root.addChild(row2, 5);

                makeDivider(-42);

                // Hàng 3: CHĂM SÓC KH + Biểu tượng HỖ TRỢ gốc của web (cắt từ ht_mn)
                var row3 = new cc.Node('RowCSKH');
                row3.setPosition(0, -74);
                row3.width = 304;
                row3.height = 52;
                row3.addChild(makeNativeLabel('CHĂM SÓC KH', -138, 0, 18));

                var cskhBtnNode = new cc.Node('BtnHotroNative');
                cskhBtnNode.setPosition(76, 0);
                var htSpComp = htMn && htMn.getComponent(cc.Sprite);
                if (htSpComp && htSpComp.spriteFrame) {
                    var origSf = htSpComp.spriteFrame;
                    var tex = origSf.getTexture();
                    var r = origSf.getRect();
                    var croppedSf = new cc.SpriteFrame(tex, cc.rect(r.x, r.y, r.width, Math.floor(r.height / 4.6)));
                    var cskhSp = cskhBtnNode.addComponent(cc.Sprite);
                    cskhSp.spriteFrame = croppedSf;
                    cskhBtnNode.setScale(0.78, 0.78);
                }
                row3.addChild(cskhBtnNode);

                row3.on(cc.Node.EventType.TOUCH_END, function (ev) {
                    if (ev && ev.stopPropagation) ev.stopPropagation();
                    panelSupport.active = false;
                    wireSetting1CskhDialog();
                    if (cc.RedT && cc.RedT.inGame && cc.RedT.inGame.dialog) {
                        var dlg = cc.RedT.inGame.dialog;
                        if (dlg.objShow && dlg.objShow !== dlg.settings1.node) dlg.objShow.active = false;
                        dlg.showSetting1();
                        if (dlg.settings1 && dlg.settings1.node) {
                            dlg.settings1.node.setPosition(0, 0);
                            dlg.settings1.node.opacity = 255;
                            dlg.settings1.node.scale = 1;
                        }
                    }
                });
                root.addChild(row3, 5);

                S.menuBgRowNode = row1;
                S.menuSfxRowNode = row2;
                S.menuCskhRowNode = row3;
                S.menuBgSwitchSp = swSp1;
                S.menuSfxSwitchSp = swSp2;
                applyAudioStates();
            }
            return true;
        } catch (e) {
            warn(e);
            return false;
        }
    }

    // ------------------------------------------------------------------ Helper: Clone Native UI Elements (Style Rút Tiền / Nạp Tiền — Ảnh 3, 4, 5)
    function getNativeUITemplates() {
        var tieuRed = cc.find('Canvas/dialog/TieuRed');
        var rutBank = tieuRed && cc.find('body/RutBank', tieuRed);
        var settingNode = cc.find('Canvas/dialog/setting');
        var topHuNode = cc.find('Canvas/dialog/TaiXiu_TopHu');
        var actBtn = rutBank && cc.find('button', rutBank);
        var btnLbl = actBtn && (actBtn.getChildByName('New Label') || actBtn.children[0]);
        return {
            tplDialogBgTop: topHuNode && topHuNode.getChildByName('dialog_bg_top'),
            tplInnerBg: tieuRed && tieuRed.getChildByName('bg_content2'),
            tplCloseBtn: topHuNode && topHuNode.getChildByName('btn_close'),
            tplInputBg: (rutBank && cc.find('number/bg-input', rutBank)) || (rutBank && cc.find('hinhthuc/bgSelect', rutBank)),
            tplCleanLabel: btnLbl || (rutBank && cc.find('hinhthuc/text', rutBank)) || (settingNode && cc.find('New Node/NhacNen/Title', settingNode)),
            tplActionBtn: actBtn,
            tplIconBtn: rutBank && cc.find('btn_lsgd', rutBank),
            tplGach: cc.find('Canvas/dialog/setting1/dialog_bg2/gach')
        };
    }

    function disableAllWidgets(node) {
        if (!node) return;
        var w = node.getComponent(cc.Widget);
        if (w) w.enabled = false;
        if (node.children && node.children.length) {
            node.children.forEach(disableAllWidgets);
        }
    }

    function createStyledCapsule(w, h, tpl) {
        var t = tpl || getNativeUITemplates();
        var node;
        if (t.tplInputBg) {
            node = cc.instantiate(t.tplInputBg);
            disableAllWidgets(node);
            node.active = true;
            node.setPosition(0, 0);
            var origW = node.width || 400;
            var origH = node.height || 59;
            var sp = node.getComponent(cc.Sprite);
            if (sp && sp.type === cc.Sprite.Type.SLICED) {
                node.width = w;
                node.height = h;
                node.setScale(1, 1);
            } else {
                node.width = origW;
                node.height = origH;
                node.scaleX = w / origW;
                node.scaleY = h / origH;
            }
        } else {
            node = new cc.Node('Capsule');
            node.width = w;
            node.height = h;
        }
        return node;
    }

    function createStyledLabel(text, x, y, fontSize, isCream, align, tpl) {
        var t = tpl || getNativeUITemplates();
        var src = t.tplCleanLabel;
        var n = src ? cc.instantiate(src) : new cc.Node('Lbl');
        disableAllWidgets(n);
        n.active = true;
        n.setScale(1, 1);
        n.setPosition(x, y);
        n.color = isCream ? cc.color(245, 238, 218) : cc.color(242, 198, 92);
        var lbl = n.getComponent(cc.Label) || n.addComponent(cc.Label);
        lbl.string = text;
        lbl.fontSize = fontSize || 18;
        lbl.lineHeight = (fontSize || 18) + 4;
        if (align === 'left') {
            n.anchorX = 0;
            n.anchorY = 0.5;
            lbl.horizontalAlign = cc.Label.HorizontalAlign.LEFT;
        } else if (align === 'right') {
            n.anchorX = 1;
            n.anchorY = 0.5;
            lbl.horizontalAlign = cc.Label.HorizontalAlign.RIGHT;
        } else {
            n.anchorX = 0.5;
            n.anchorY = 0.5;
            lbl.horizontalAlign = cc.Label.HorizontalAlign.CENTER;
        }
        lbl.overflow = cc.Label.Overflow.NONE;
        return n;
    }

    function createStyledActionButton(labelText, x, y, w, h, tpl, onClick) {
        var t = tpl || getNativeUITemplates();
        var btnNode;
        var sx = 1, sy = 1;
        if (t.tplActionBtn) {
            btnNode = cc.instantiate(t.tplActionBtn);
            disableAllWidgets(btnNode);
            btnNode.name = 'ActionBtn';
            btnNode.active = true;
            btnNode.setPosition(x, y);
            var bComp = btnNode.getComponent(cc.Button);
            if (bComp) {
                bComp.clickEvents = [];
                bComp.enabled = false;
                btnNode.removeComponent(cc.Button);
            }
            var origW = btnNode.width || 206;
            var origH = btnNode.height || 67;
            sx = (w || 175) / origW;
            sy = (h || 56) / origH;
            btnNode.setScale(sx, sy);
            var lblNode = btnNode.getChildByName('New Label') || btnNode.children[0];
            if (lblNode) {
                lblNode.setPosition(0, 0);
                lblNode.scaleX = sy / sx;
                lblNode.scaleY = 1;
                var lbl = lblNode.getComponent(cc.Label);
                if (lbl) {
                    lbl.string = labelText;
                    lbl.fontSize = 21;
                    lbl.lineHeight = 25;
                    lbl.overflow = cc.Label.Overflow.NONE;
                }
            }
        } else {
            btnNode = new cc.Node('ActionBtn');
            btnNode.width = w || 175;
            btnNode.height = h || 56;
            btnNode.setPosition(x, y);
            btnNode.addChild(createStyledLabel(labelText, 0, 0, 18, true, 'center', t));
        }
        if (typeof onClick === 'function') {
            btnNode.on(cc.Node.EventType.TOUCH_START, function () {
                btnNode.setScale(sx * 0.95, sy * 0.95);
            });
            btnNode.on(cc.Node.EventType.TOUCH_CANCEL, function () {
                btnNode.setScale(sx, sy);
            });
            btnNode.on(cc.Node.EventType.TOUCH_END, function (ev) {
                btnNode.setScale(sx, sy);
                onClick(ev);
            });
        }
        return btnNode;
    }

    // ------------------------------------------------------------------ 2. Hệ thống NHIỆM VỤ (Dialog.NhiemVu / GioiThieu)
    var DEFAULT_MISSIONS = [
        {id: 100, tennv: 'Tài Xỉu', dieukien: 1000000, phanthuong: 10000, noidung: 'Đạt tổng cược 1.000.000 với game Tài Xỉu', claimed: false},
        {id: 101, tennv: 'Tài Xỉu', dieukien: 2000000, phanthuong: 20000, noidung: 'Đạt tổng cược 2.000.000 với game Tài Xỉu', claimed: false},
        {id: 102, tennv: 'Tài Xỉu', dieukien: 3000000, phanthuong: 30000, noidung: 'Đạt tổng cược 3.000.000 với game Tài Xỉu', claimed: false},
        {id: 103, tennv: 'Tài Xỉu', dieukien: 4000000, phanthuong: 40000, noidung: 'Đạt tổng cược 4.000.000 với game Tài Xỉu', claimed: false},
        {id: 104, tennv: 'Tài Xỉu', dieukien: 5000000, phanthuong: 50000, noidung: 'Đạt tổng cược 5.000.000 với game Tài Xỉu', claimed: false}
    ];

    function buildNhiemVuSkeleton(nvNode) {
        if (!nvNode) return null;
        nvNode.opacity = 255;
        nvNode.scale = 1;

        var oldBg = nvNode.getChildByName('bg');
        if (oldBg) oldBg.active = false;
        var oldGt = nvNode.getChildByName('Gioithieu');
        if (oldGt) oldGt.active = false;
        var popupBig = nvNode.getChildByName('popup-big');
        if (popupBig) popupBig.active = false;

        var tpl = getNativeUITemplates();

        var panel = nvNode.getChildByName('CustomNhiemVuPanel');
        if (!panel) {
            panel = new cc.Node('CustomNhiemVuPanel');
            panel.setPosition(0, -10);
            nvNode.addChild(panel, 10);

            // 1. Khung nền đen-vàng chuẩn Go88 (clone từ dialog_bg_top của Lịch Sử Hũ & bg_content2 của Rút Tiền - Ảnh 3)
            if (tpl.tplDialogBgTop) {
                var mainBg = cc.instantiate(tpl.tplDialogBgTop);
                disableAllWidgets(mainBg);
                mainBg.active = true;
                mainBg.setPosition(0, 0);
                mainBg.width = 960;
                mainBg.height = 590;
                var bgTitle = mainBg.getChildByName('bg_title');
                if (bgTitle) {
                    bgTitle.setPosition(0, 266);
                    var tNode = bgTitle.getChildByName('Title');
                    var tLbl = tNode && tNode.getComponent(cc.Label);
                    if (tLbl) {
                        tLbl.string = 'Nhiệm Vụ';
                        tLbl.fontSize = 30;
                    }
                }
                panel.addChild(mainBg, 0);
            }

            if (tpl.tplInnerBg) {
                var innerBg = cc.instantiate(tpl.tplInnerBg);
                disableAllWidgets(innerBg);
                innerBg.active = true;
                innerBg.setPosition(0, -24);
                innerBg.width = 900;
                innerBg.height = 476;
                panel.addChild(innerBg, 1);
            }

            var summaryNode = new cc.Node('NVSummaryBar');
            summaryNode.setPosition(0, 168);
            panel.addChild(summaryNode, 5);

            var rowsNode = new cc.Node('NVRowsContainer');
            rowsNode.setPosition(0, -44);
            panel.addChild(rowsNode, 5);
        }

        var xBtn = nvNode.getChildByName('x');
        if (xBtn) {
            disableAllWidgets(xBtn);
            xBtn.active = true;
            xBtn.zIndex = 30;
            xBtn.setPosition(426, 250);
            if (!xBtn._nvCloseWired) {
                xBtn._nvCloseWired = true;
                var xbComp = xBtn.getComponent(cc.Button);
                if (xbComp) xbComp.clickEvents = [];
                xBtn.off(cc.Node.EventType.TOUCH_END);
                xBtn.on(cc.Node.EventType.TOUCH_END, function (ev) {
                    if (ev && ev.stopPropagation) ev.stopPropagation();
                    if (cc.RedT && cc.RedT.audio && cc.RedT.audio.playClick) cc.RedT.audio.playClick();
                    if (cc.RedT && cc.RedT.inGame && cc.RedT.inGame.dialog) {
                        cc.RedT.inGame.dialog.onCloseDialog();
                    } else {
                        nvNode.active = false;
                    }
                });
            }
        }
        return panel;
    }

    function renderNhiemVuUI(comp, data) {
        try {
            var nvNode = (comp && comp.node) || cc.find('Canvas/dialog/GioiThieu');
            if (!nvNode) return;
            var panel = buildNhiemVuSkeleton(nvNode);
            if (!panel) return;

            var tpl = getNativeUITemplates();
            var tRedPlay = (data && data.userInfo && Number(data.userInfo.tRedPlay)) || 0;
            var missions = (data && Array.isArray(data.dataNhiemVu) && data.dataNhiemVu.length) ? data.dataNhiemVu : DEFAULT_MISSIONS;

            // Thanh thông tin tổng cược hiện tại theo chuẩn giao diện Rút Tiền (Ảnh 3)
            var summaryNode = panel.getChildByName('NVSummaryBar');
            if (summaryNode) {
                summaryNode.removeAllChildren();
                summaryNode.addChild(createStyledLabel('Tổng Cược Tài Xỉu :', -415, 0, 20, false, 'left', tpl));
                var totalBox = createStyledCapsule(310, 48, tpl);
                totalBox.setPosition(-60, 0);
                summaryNode.addChild(totalBox);
                summaryNode.addChild(createStyledLabel('$ ' + numberWithCommas(tRedPlay), -60, 0, 21, true, 'center', tpl));
                summaryNode.addChild(createStyledLabel('Hoàn thành mốc cược để nhận thưởng', 120, 0, 16, false, 'left', tpl));

                if (tpl.tplGach) {
                    var topDiv = cc.instantiate(tpl.tplGach);
                    topDiv.active = true;
                    topDiv.setPosition(0, -34);
                    topDiv.width = 840;
                    topDiv.height = 3;
                    summaryNode.addChild(topDiv);
                }
            }

            var rowsContainer = panel.getChildByName('NVRowsContainer');
            if (!rowsContainer) return;
            rowsContainer.removeAllChildren();

            missions.slice(0, 5).forEach(function (item, idx) {
                var req = Number(item.dieukien) || 1;
                var reward = Number(item.phanthuong) || 0;
                var claimed = !!item.claimed;
                var cur = Math.min(req, Math.max(0, Number(tRedPlay) || 0));
                var pct = Math.min(100, Math.round((cur / req) * 100));
                var canClaim = !claimed && cur >= req;

                var rowNode = new cc.Node('MissionRow_' + idx);
                rowNode.setPosition(0, 144 - idx * 74);
                rowNode.width = 860;
                rowNode.height = 64;
                rowsContainer.addChild(rowNode);

                // 1. Icon tròn viền vàng bên trái (giống Ảnh 4 - btn_lsgd)
                if (tpl.tplIconBtn) {
                    var ic = cc.instantiate(tpl.tplIconBtn);
                    disableAllWidgets(ic);
                    ic.active = true;
                    ic.setPosition(-398, 0);
                    ic.setScale(1.05, 1.05);
                    var icBtn = ic.getComponent(cc.Button);
                    if (icBtn) {
                        icBtn.clickEvents = [];
                        icBtn.enabled = false;
                        ic.removeComponent(cc.Button);
                    }
                    rowNode.addChild(ic);
                }

                // 2. Khung nội dung nhiệm vụ & tiến độ (giống Ảnh 3 - bg-input)
                var infoBox = createStyledCapsule(450, 58, tpl);
                infoBox.setPosition(-132, 0);
                rowNode.addChild(infoBox);

                var titleStr = (item.tennv || 'Tài Xỉu') + ' : ' + (item.noidung || '');
                rowNode.addChild(createStyledLabel(titleStr, -336, 11, 16, false, 'left', tpl));
                var progStr = 'Tiến độ : ' + numberWithCommas(cur) + ' / ' + numberWithCommas(req) + ' (' + pct + '%)';
                rowNode.addChild(createStyledLabel(progStr, -336, -12, 15, true, 'left', tpl));

                // 3. Khung tiền thưởng (giống Ảnh 3 - bg-input)
                var rwBox = createStyledCapsule(176, 58, tpl);
                rwBox.setPosition(198, 0);
                rowNode.addChild(rwBox);
                rowNode.addChild(createStyledLabel('Phần Thưởng', 198, 12, 14, false, 'center', tpl));
                rowNode.addChild(createStyledLabel('+ ' + numberWithCommas(reward) + ' $', 198, -11, 18, true, 'center', tpl));

                // 4. Nút bấm hành động (giống Ảnh 5 - chỉ gắn sự kiện vào đúng nút Nhận Thưởng / Làm Nhiệm Vụ)
                var btnText = claimed ? 'Đã Nhận' : (canClaim ? 'Nhận Thưởng' : 'Làm Nhiệm Vụ');
                var actBtn = createStyledActionButton(btnText, 372, 0, 152, 54, tpl, function (ev) {
                    if (ev && ev.stopPropagation) ev.stopPropagation();
                    if (cc.RedT && cc.RedT.audio && cc.RedT.audio.playClick) cc.RedT.audio.playClick();
                    if (item.claimed) {
                        if (cc.RedT && cc.RedT.inGame && cc.RedT.inGame.notice) {
                            cc.RedT.inGame.notice.show({title: 'NHIỆM VỤ', text: 'Bạn đã nhận thưởng nhiệm vụ này rồi!'});
                        }
                        return;
                    }
                    if (tRedPlay >= req) {
                        cc.RedT.send({nhanthuong: item});
                    } else {
                        if (cc.RedT && cc.RedT.inGame && cc.RedT.inGame.dialog) {
                            cc.RedT.inGame.dialog.onCloseDialog();
                        }
                        if (cc.RedT && cc.RedT.MiniPanel && cc.RedT.MiniPanel.TaiXiu) {
                            cc.RedT.MiniPanel.TaiXiu.openGame();
                        }
                    }
                });
                if (claimed) {
                    actBtn.opacity = 135;
                } else if (!canClaim) {
                    actBtn.opacity = 225;
                }
                rowNode.addChild(actBtn);
            });
        } catch (e) {
            warn(e);
        }
    }

    // ------------------------------------------------------------------ 3. Nổ Hũ Bàn Tài Xỉu Thường & Đồng Bộ SĂN HŨ (Footer + TopHuTx)
    S.currentHuTx = 5000000;

    function updateSanHuHeaderAndDialog(amount) {
        try {
            if (amount !== undefined && amount !== null && Number(amount) > 0) {
                S.currentHuTx = Math.floor(Number(amount));
            }
            var formatted = numberWithCommas(S.currentHuTx);

            // 1. Đồng bộ số hũ trên bàn Tài Xỉu thường (TX_Main.hu)
            if (cc.RedT && cc.RedT.MiniPanel && cc.RedT.MiniPanel.TaiXiu && cc.RedT.MiniPanel.TaiXiu.TX_Main) {
                var txMain = cc.RedT.MiniPanel.TaiXiu.TX_Main;
                if (txMain.hu && txMain.hu.string !== formatted) {
                    txMain.hu.string = formatted;
                }
            }

            // 2. Đồng bộ số hũ trên thẻ Tài Xỉu ngoài sảnh (inGame.tienhutx)
            if (cc.RedT && cc.RedT.inGame && cc.RedT.inGame.tienhutx) {
                if (cc.RedT.inGame.tienhutx.string !== formatted) {
                    cc.RedT.inGame.tienhutx.string = formatted;
                }
            }

            var tpl = getNativeUITemplates();

            // 3. Đồng bộ badge tiền hũ realtime trên nút SĂN HŨ ở thanh Footer88 bên dưới (dùng khung bg-input & font gốc)
            var jpFooter = cc.find('Canvas/Footer88/JackpotIcon');
            if (jpFooter && tpl.tplInputBg) {
                var pill = jpFooter.getChildByName('LiveHuFooterBadge');
                if (!pill) {
                    pill = new cc.Node('LiveHuFooterBadge');
                    pill.setPosition(0, 44);
                    var pillBg = createStyledCapsule(124, 24, tpl);
                    pill.addChild(pillBg);
                    var pillLbl = createStyledLabel('$ ' + formatted, 0, 0, 12, true, 'center', tpl);
                    pillLbl.name = 'HuValLbl';
                    pill.addChild(pillLbl);
                    jpFooter.addChild(pill, 25);
                }
                if (pill._lastStr !== formatted) {
                    pill._lastStr = formatted;
                    var pLblNode = pill.getChildByName('HuValLbl');
                    var pLbl = pLblNode && pLblNode.getComponent(cc.Label);
                    if (pLbl) pLbl.string = '$ ' + formatted;
                }
            }

            // 4. Đồng bộ thanh HŨ HIỆN TẠI trong bảng SĂN HŨ / Lịch Sử Hũ (Ảnh 2 - dùng chuẩn UI Ảnh 3, 4, 5)
            var topHuComp = cc.RedT && cc.RedT.inGame && cc.RedT.inGame.dialog && cc.RedT.inGame.dialog.TopHuTx;
            if (topHuComp && !topHuComp._renderDataHooked) {
                topHuComp._renderDataHooked = true;
                var origTopHuOnData = topHuComp.onData.bind(topHuComp);
                function forceRefreshLabel(lbl) {
                    if (!lbl) return;
                    var s = lbl.string;
                    lbl._string = '';
                    lbl.string = s;
                    if (lbl._forceUpdateRenderData) lbl._forceUpdateRenderData();
                }
                topHuComp.onData = function (data) {
                    origTopHuOnData(data);
                    try {
                        forceRefreshLabel(this.phien);
                        forceRefreshLabel(this.tonguser);
                        forceRefreshLabel(this.line);
                        forceRefreshLabel(this.tienhu);
                        if (Array.isArray(this.content)) {
                            this.content.forEach(function (it) {
                                if (it && it.node && it.node.active) {
                                    forceRefreshLabel(it.top);
                                    forceRefreshLabel(it.nick);
                                    forceRefreshLabel(it.win);
                                }
                            });
                        }
                    } catch (e) {}
                };
            }
            var topHuNode = cc.find('Canvas/dialog/TaiXiu_TopHu') || (topHuComp && topHuComp.node);
            if (topHuNode && tpl.tplInputBg) {
                var liveBar = topHuNode.getChildByName('LiveSanHuBar');
                if (!liveBar) {
                    liveBar = new cc.Node('LiveSanHuBar');
                    liveBar.setPosition(0, -248);
                    liveBar.width = 620;
                    liveBar.height = 50;

                    var barBg = createStyledCapsule(620, 48, tpl);
                    liveBar.addChild(barBg);

                    if (tpl.tplIconBtn) {
                        var barIcon = cc.instantiate(tpl.tplIconBtn);
                        disableAllWidgets(barIcon);
                        barIcon.active = true;
                        barIcon.setPosition(-280, 0);
                        barIcon.setScale(0.78, 0.78);
                        var bComp = barIcon.getComponent(cc.Button);
                        if (bComp) {
                            bComp.clickEvents = [];
                            bComp.enabled = false;
                            barIcon.removeComponent(cc.Button);
                        }
                        liveBar.addChild(barIcon);
                    }

                    liveBar.addChild(createStyledLabel('Quỹ Hũ Tài Xỉu :', -250, 0, 17, false, 'left', tpl));

                    var valNode = createStyledLabel('$ ' + formatted, -86, 0, 19, true, 'left', tpl);
                    valNode.name = 'LiveHuVal';
                    liveBar.addChild(valNode);

                    var openTaiXiuFromSanHu = function (ev) {
                        if (ev && ev.stopPropagation) ev.stopPropagation();
                        if (cc.RedT && cc.RedT.audio && cc.RedT.audio.playClick) cc.RedT.audio.playClick();
                        if (cc.RedT && cc.RedT.inGame && cc.RedT.inGame.dialog) {
                            cc.RedT.inGame.dialog.onCloseDialog();
                        }
                        if (cc.RedT && cc.RedT.MiniPanel && cc.RedT.MiniPanel.TaiXiu) {
                            cc.RedT.MiniPanel.TaiXiu.openGame();
                        }
                    };

                    var enterBtn = createStyledActionButton('Vào Bàn Săn Hũ', 210, 0, 172, 42, tpl, openTaiXiuFromSanHu);
                    liveBar.addChild(enterBtn);

                    topHuNode.addChild(liveBar, 30);
                    liveBar.on(cc.Node.EventType.TOUCH_END, openTaiXiuFromSanHu);
                }
                if (liveBar._lastStr !== formatted) {
                    liveBar._lastStr = formatted;
                    var vNode = liveBar.getChildByName('LiveHuVal');
                    var vLbl = vNode && vNode.getComponent(cc.Label);
                    if (vLbl) vLbl.string = '$ ' + formatted;
                }
            }
        } catch (e) {}
    }

    function playDiceRollSound(mainComp) {
        try {
            if (!isGameSoundOn()) return;
            var as = null;
            if (mainComp && mainComp.xnAnimation && mainComp.xnAnimation[0] && mainComp.xnAnimation[0].node) {
                as = mainComp.xnAnimation[0].node.getComponent(cc.AudioSource);
            }
            if (!as && cc.RedT && cc.RedT.MiniPanel && cc.RedT.MiniPanel.TaiXiu && cc.RedT.MiniPanel.TaiXiu.node) {
                var xxNode = cc.RedT.MiniPanel.TaiXiu.node.getChildByName('xucxacsoud');
                if (xxNode) as = xxNode.getComponent(cc.AudioSource);
            }
            if (!as) return;
            if (as.clip && cc.audioEngine && cc.audioEngine.playEffect) {
                cc.audioEngine.playEffect(as.clip, false);
            } else {
                as.play();
            }
        } catch (e) {}
    }

    function hookNormalTaiXiuReveal() {
        try {
            if (!cc.RedT || !cc.RedT.MiniPanel || !cc.RedT.MiniPanel.TaiXiu || !cc.RedT.MiniPanel.TaiXiu.TX_Main) return false;
            var txMain = cc.RedT.MiniPanel.TaiXiu.TX_Main;
            if (txMain._revealHooked) return true;
            txMain._revealHooked = true;

            var origTxComp = cc.RedT.MiniPanel.TaiXiu;
            origTxComp.regEvent = function (view) {
                cc.RedT.send({taixiu: view ? {view: true, getLogs: true} : {view: false}});
            };
            var origOpenGame = origTxComp.openGame && origTxComp.openGame.bind(origTxComp);
            if (origOpenGame) {
                origTxComp.openGame = function () {
                    origOpenGame();
                    if (cc.RedT.IS_LOGIN && this.node && this.node.active) {
                        this.regEvent(true);
                    }
                };
            }
            origTxComp.signIn = function () {
                if (this.node && this.node.active) {
                    this.regEvent(true);
                }
            };

            var Helper = window.__require('Helper');

            // 0. Hook setDice cho bàn xanh để reset setup pose (tránh kẹt mặt 2 khi ra 1-1-1)
            txMain.setDice = function () {
                var show = arguments.length > 0 && void 0 !== arguments[0] && arguments[0];
                var setSf = !(arguments.length > 1 && void 0 !== arguments[1]) || arguments[1];
                var self = this;
                var currentDiceArray = this._currentDices || (cc.RedT.setting.taixiu.logs && cc.RedT.setting.taixiu.logs[0] && cc.RedT.setting.taixiu.logs[0].dice);
                if (!currentDiceArray) return;
                if (this.xnEffect) this.xnEffect.node.active = false;
                this.dice.forEach(function (d, idx) {
                    if (setSf && self.diceSF && currentDiceArray[idx]) {
                        d.spriteFrame = self.diceSF[currentDiceArray[idx] - 1];
                    }
                    d.node.active = show;
                });
                this.xnAnimation.forEach(function (anim, idx) {
                    if (!anim) return;
                    try {
                        anim.setCompleteListener(null);
                    } catch (e0) {}
                    if (anim.node) anim.node.active = show;
                    if (show && currentDiceArray[idx]) {
                        try {
                            ensureDiceSpineBones(anim, currentDiceArray[idx]);
                            if (anim.setToSetupPose) anim.setToSetupPose();
                            anim.setAnimation(0, '' + currentDiceArray[idx], false);
                            ensureDiceSpineBones(anim, currentDiceArray[idx]);
                        } catch (e) {}
                    }
                });
            };

            txMain.onDiceAnimationFinish = function () {
                this.setDice(true);
                if (!this.isNan) {
                    this.DiaNan();
                }
                if (this.diceAnimation) this.diceAnimation.node.active = false;
                if (this.xnEffect) this.xnEffect.node.active = false;
            };

            // 1. Hook DiaNan cho bàn xanh
            var origNormalDiaNan = txMain.DiaNan.bind(txMain);
            txMain.DiaNan = function () {
                if (cc.RedT.setting.taixiu.time_remain > 46 && this._diceDone === false) return;
                if (this._txRevealed) return;
                this._txRevealed = true;
                S.normalWaitingReveal = false;
                if (this._pendingLog && cc.RedT.setting.taixiu.logs) {
                    cc.RedT.setting.taixiu.logs.unshift(this._pendingLog);
                    if (cc.RedT.setting.taixiu.logs.length > 120) cc.RedT.setting.taixiu.logs.pop();
                    this._pendingLog = null;
                }
                var normalActive = !!(this.node && this.node.active && cc.RedT.MiniPanel.TaiXiu.node && cc.RedT.MiniPanel.TaiXiu.node.active);
                var origSound = cc.RedT.IS_SOUND;
                if (!normalActive) cc.RedT.IS_SOUND = false;
                try {
                    origNormalDiaNan();
                } finally {
                    cc.RedT.IS_SOUND = origSound;
                }
                if (this._results && this._results.win !== undefined) {
                    this.status();
                }
                if (S.pendingUserRed !== null && S.pendingUserRed !== undefined) {
                    var r = S.pendingUserRed;
                    S.pendingUserRed = null;
                    syncUserBalances({red: r});
                }
            };

            // 2. Hook playTime cho bàn xanh: 45s cược, 15s mở bát, dừng cược ở 5s
            txMain.playTime = function () {
                if (void 0 !== this.timeInterval) clearInterval(this.timeInterval);
                if (this.audioWin) this.audioWin.stop();
                this._results = {};
                this.timeInterval = setInterval(function () {
                    var tr = cc.RedT.setting.taixiu.time_remain;
                    if (tr > 46) {
                        if (null !== this.bg_Dice._animator && this.bg_Dice._animator.isPlaying) this.bg_Dice.stop();
                        this.bg_efDice.active = false;
                        var t = Helper.numberPad(tr - 46, 2);
                        this.timeWait.string = +t;
                        if (tr < 48) this.efStop();
                        if (tr < 47) {
                            this.nodeKetQua.active = false;
                            if (this.isNan) this.diaNan.active = false;
                        }
                    } else {
                        if (null !== this.bg_Dice._animator && !this.bg_Dice._animator.isPlaying) {
                            var animState = this.bg_Dice.getAnimationState(this.bg_Dice._defaultClip.name);
                            animState.speed = 1;
                            this.bg_Dice._animator.playState(animState);
                        }
                        if (null !== this.bg_Dice._animator && this.bg_Dice._animator.isPlaying) {
                            if (tr < 7) this.bg_Dice._animator._anims.array[0].speed = 10;
                            else if (tr < 23) this.bg_Dice._animator._anims.array[0].speed = 6;
                            else if (tr < 33) this.bg_Dice._animator._anims.array[0].speed = 3;
                        }
                        this.bg_efDice.active = true;
                        this._diceDone = true;
                        if (this.xnEffect) this.xnEffect.node.active = false;
                        if (this.diceAnimation) this.diceAnimation.node.active = false;
                        if (!this._txRevealed && (S.normalWaitingReveal || this._pendingLog)) {
                            this.DiaNan();
                        }
                        S.normalWaitingReveal = false;
                        if (S.pendingUserRed !== null && S.pendingUserRed !== undefined) {
                            var targetR = S.pendingUserRed;
                            S.pendingUserRed = null;
                            syncUserBalances({red: targetR});
                        }
                        if (this.xnAnimation[0] && this.xnAnimation[0].node.active) {
                            this.setDice(false, false);
                            this.reset();
                        }
                        this.efStop();
                        this.nodeTimeWait.active = this.nodeKetQua.active = this.diaNan.active = false;
                        this.timeCuoc.node.active = this.spriteNan.node.active = true;
                        if (tr > 0) {
                            var tc = Helper.numberPad(tr - 1, 2);
                            this.timeCuoc.string = +tc;
                            this.timeCuoc.node.color = tr <= 6 ? cc.color(255, 69, 69, 255) : cc.Color.WHITE;
                        } else {
                            clearInterval(this.timeInterval);
                        }
                    }
                    cc.RedT.setting.taixiu.time_remain--;
                }.bind(this), 1000);
            };

            // 3. Hook nextRealTime cho bàn xanh
            txMain.nextRealTime = function () {
                var tr = cc.RedT.setting.taixiu.time_remain;
                if (tr > 46) {
                    this.setDice(true);
                    this.nodeTimeWait.active = true;
                    this.timeCuoc.node.active = false;
                    var t = Helper.numberPad(tr - 46, 2);
                    this.timeWait.string = +t;
                } else {
                    this.nodeTimeWait.active = false;
                    this.timeCuoc.node.active = true;
                    if (tr > 0) {
                        var tc = Helper.numberPad(tr - 1, 2);
                        this.timeCuoc.string = +tc;
                        this.timeCuoc.node.color = tr <= 6 ? cc.color(255, 69, 69, 255) : cc.Color.WHITE;
                    }
                }
            };

            // 4. Hook onCuocClick cho bàn xanh: ngừng cược khi còn 5s, thông báo căn tâm bàn xanh
            txMain.onCuocClick = function () {
                var bet = Helper.getOnlyNumberInString(this.input.string);
                bet = parseInt(bet);
                this.input.string = this.RedT.board ? '' : '0';
                this.TX_Board.node.active = false;
                var tr = cc.RedT.setting.taixiu.time_remain;
                if (tr <= 6 || tr > 46) {
                    showTableNotice(this, 'Hết thời gian đặt cược !');
                    return;
                }
                if (isNaN(bet) || bet < 1000) {
                    showTableNotice(this, 'Tiền cược phải lớn hơn 1.000');
                } else {
                    cc.RedT.send({taixiu: {cuoc: {select: this.inputOld == 'left', bet: bet}}});
                }
            };

            // 5. Hook onData cho bàn xanh: xử lý finish chuẩn 61s, trì hoãn kết quả tới khi mở bát, phát tiếng xúc xắc lắc
            var origNormalOnData = txMain.onData.bind(txMain);
            txMain.onData = function (t) {
                if (!t) return;
                var normalActive = !!(this.node && this.node.active && cc.RedT.MiniPanel.TaiXiu.node && cc.RedT.MiniPanel.TaiXiu.node.active);
                var copyT = Object.assign({}, t);
                if (copyT.err) {
                    if (normalActive) {
                        showTableNotice(this, copyT.err);
                    }
                    delete copyT.err;
                }
                if (copyT.finish3) {
                    cc.RedT.setting.taixiu.time_remain = 48;
                    this.playTime();
                    delete copyT.finish3;
                }
                if (void 0 !== copyT.sync_time) {
                    var syncTr = copyT.sync_time;
                    delete copyT.sync_time;
                    var curTxTr = cc.RedT.setting.taixiu.time_remain;
                    if (!this.timeInterval || curTxTr === undefined || curTxTr <= 0 || Math.abs(curTxTr - syncTr) >= 2) {
                        cc.RedT.setting.taixiu.time_remain = syncTr;
                        this.playTime();
                        this.nextRealTime();
                    }
                }
                if (void 0 !== copyT.sync_phien) {
                    var syncPh = copyT.sync_phien;
                    delete copyT.sync_phien;
                    var txLogs = cc.RedT.setting.taixiu.logs;
                    var latestTxPhien = (txLogs && txLogs[0] && txLogs[0].phien) ? Number(txLogs[0].phien) : 0;
                    var checkTxTr = cc.RedT.setting.taixiu.time_remain;
                    var needTxResync = !cc.RedT.setting.taixiu.getLogs || !latestTxPhien || (checkTxTr <= 46 && (latestTxPhien + 1) !== Number(syncPh));
                    if (needTxResync && normalActive) {
                        var nowTxMs = Date.now();
                        if (!this._lastAutoSyncLogs || (nowTxMs - this._lastAutoSyncLogs > 2000)) {
                            this._lastAutoSyncLogs = nowTxMs;
                            if (cc.RedT && typeof cc.RedT.send === 'function') {
                                cc.RedT.send({taixiu: {view: normalActive, getLogs: true}});
                            }
                        }
                    }
                }
                if (copyT.finish) {
                    var fin = copyT.finish;
                    delete copyT.finish;
                    cc.RedT.setting.taixiu.getLogs = true;
                    if (true) {
                        if (void 0 !== this.timeInterval) clearInterval(this.timeInterval);
                        this._txRevealed = false;
                        this._diceDone = false;
                        this._floatingShown = false;
                        S.normalWaitingReveal = true;
                        this._pendingLog = {dice: [fin.dices[0], fin.dices[1], fin.dices[2]], phien: fin.phien};
                        this._currentDices = [fin.dices[0], fin.dices[1], fin.dices[2]];
                        this.diemSo = fin.dices[0] + fin.dices[1] + fin.dices[2];
                        this.setDice(true);
                        if (this.diceAnimation) this.diceAnimation.node.active = true;
                        if (this.xnAnimation[0] && this.xnAnimation[0].setToSetupPose) this.xnAnimation[0].setToSetupPose();
                        if (this.xnAnimation[1] && this.xnAnimation[1].setToSetupPose) this.xnAnimation[1].setToSetupPose();
                        if (this.xnAnimation[2] && this.xnAnimation[2].setToSetupPose) this.xnAnimation[2].setToSetupPose();
                        this.xnAnimation[0].setAnimation(0, 'xi ngau bay ' + fin.dices[0], false);
                        this.xnAnimation[1].setAnimation(0, 'xi ngau bay ' + fin.dices[1], false);
                        this.xnAnimation[2].setAnimation(0, 'xi ngau bay ' + fin.dices[2], false);
                        if (this.xnEffect) this.xnEffect.node.active = false;
                        setTimeout(function () {
                            if (this.xnEffect) this.xnEffect.node.active = false;
                            if (this.diceAnimation) this.diceAnimation.node.active = false;
                        }.bind(this), 2500);
                        if (this.isNan) {
                            setTimeout(function () {
                                if (cc.RedT.setting.taixiu.time_remain > 46) {
                                    this.diaNan.active = true;
                                    this.diaNan.position = cc.v2(0, -8);
                                    this.nodeKetQua.active = false;
                                }
                            }.bind(this), 2100);
                            this.nodeTimeWait.active = true;
                        }
                        this.timeCuoc.node.active = false;
                        if (normalActive) {
                            playDiceRollSound(this);
                        }
                        var finishNormalRoll = function () {
                            if (this._diceDone) return;
                            this._diceDone = true;
                            if (cc.RedT.setting.taixiu.time_remain > 46) {
                                this.labelKetQua.string = this.diemSo;
                                this.nodeTimeWait.active = true;
                                this.onDiceAnimationFinish();
                            }
                        }.bind(this);
                        this.xnAnimation[0].setCompleteListener(function () {
                            setTimeout(finishNormalRoll, 100);
                        });
                        setTimeout(finishNormalRoll, 2550);
                    }
                    cc.RedT.setting.taixiu.time_remain = 61;
                    this.playTime();
                }
                if (Object.keys(copyT).length === 0) return;
                if (!normalActive) {
                    var origSound = cc.RedT.IS_SOUND;
                    cc.RedT.IS_SOUND = false;
                    try {
                        return origNormalOnData(copyT);
                    } finally {
                        cc.RedT.IS_SOUND = origSound;
                    }
                }
                return origNormalOnData(copyT);
            };

            // 6. Hook status cho bàn xanh: chỉ hiện thông báo cộng tiền sau khi đã mở bát (_txRevealed === true)
            txMain.status = function (t) {
                var normalActive = !!(this.node && this.node.active && cc.RedT.MiniPanel.TaiXiu.node && cc.RedT.MiniPanel.TaiXiu.node.active);
                if (void 0 !== t) {
                    this._results = t;
                    if (!this._txRevealed) {
                        S.normalWaitingReveal = true;
                        return;
                    }
                } else {
                    t = this._results;
                }
                if (!t || this._floatingShown) return;
                this._floatingShown = true;
                if (normalActive) {
                    showTableFloatingResult(this, t);
                    if (isGameSoundOn() && this.audioWin && t.win) {
                        try { this.audioWin.play(); } catch (e) {}
                    }
                }
                try { cc.RedT.send({taixiu: {get_new: true}}); } catch (e) {}
            };
            return true;
        } catch (e) {
            return false;
        }
    }

    function wireNormalTaiXiuJackpotHeader() {
        try {
            if (!cc.RedT || !cc.RedT.MiniPanel || !cc.RedT.MiniPanel.TaiXiu || !cc.RedT.MiniPanel.TaiXiu.TX_Main) return false;
            var txMain = cc.RedT.MiniPanel.TaiXiu.TX_Main;
            var new2022 = txMain.node.getChildByName('new2022');
            if (new2022) new2022.zIndex = 30;
            var jpNode = txMain.node.getChildByName('Jackpot');
            if (jpNode) jpNode.zIndex = 5;
            var titleNode = txMain.background && txMain.background.getChildByName('TaiXiu_title');

            [new2022, titleNode].forEach(function (target) {
                if (!target || target._huClickWired) return;
                target._huClickWired = true;
                if (target.width < 120) target.width = 220;
                if (target.height < 40) target.height = 55;
                target.on(cc.Node.EventType.TOUCH_END, function (ev) {
                    if (ev && ev.stopPropagation) ev.stopPropagation();
                    if (cc.RedT && cc.RedT.audio && cc.RedT.audio.playClick) cc.RedT.audio.playClick();
                    if (cc.RedT && cc.RedT.inGame && cc.RedT.inGame.dialog) {
                        cc.RedT.inGame.dialog.showTopHuTx();
                    }
                });
            });
            return true;
        } catch (e) {
            return false;
        }
    }

    function triggerNormalTaiXiuJackpotEffect(txMain, jpData) {
        try {
            txMain = txMain || (cc.RedT && cc.RedT.MiniPanel && cc.RedT.MiniPanel.TaiXiu && cc.RedT.MiniPanel.TaiXiu.TX_Main);
            if (!txMain || !txMain.node) return;

            var dicesSum = Number(jpData && jpData.dices) || 18;
            var isXiu = (dicesSum === 3);
            var phien = (jpData && jpData.phien) || (cc.RedT && cc.RedT.setting && cc.RedT.setting.taixiu && cc.RedT.setting.taixiu.logs && cc.RedT.setting.taixiu.logs[0] && cc.RedT.setting.taixiu.logs[0].phien) || '';
            var quyhu = Number(jpData && jpData.quyhu) || S.currentHuTx || 5000000;
            var tonguser = Number(jpData && jpData.tonguser) || 1;

            if (isGameSoundOn() && txMain.audioWin) {
                try { txMain.audioWin.play(); } catch (e) {}
            }

            // 1. Bật hiệu ứng Spine Jackpot ("JP no hu") trên bàn Tài Xỉu thường
            var jpNode = txMain.node.getChildByName('Jackpot');
            if (jpNode) {
                jpNode.active = true;
                jpNode.zIndex = 55;
                var skel = jpNode.getComponent(sp.Skeleton);
                if (skel) {
                    try {
                        skel.setAnimation(0, 'JP no hu', false);
                        skel.setCompleteListener(function () {
                            try { skel.setAnimation(0, 'JP idle', true); } catch (e) {}
                        });
                    } catch (e) {}
                }
                clearTimeout(jpNode._hideTimer);
                jpNode._hideTimer = setTimeout(function () {
                    if (jpNode && jpNode.isValid) jpNode.active = false;
                }, 8500);
            }

            // 2. Hiển thị Banner Vinh Danh Nổ Hũ trên bàn Tài Xỉu thường (bấm vào mở Lịch Sử Hũ, dùng chuẩn UI gốc)
            var banner = txMain.node.getChildByName('JackpotCelebrationBanner');
            if (!banner) {
                banner = new cc.Node('JackpotCelebrationBanner');
                banner.setPosition(0, -148);
                txMain.node.addChild(banner, 65);
                banner.on(cc.Node.EventType.TOUCH_END, function (ev) {
                    if (ev && ev.stopPropagation) ev.stopPropagation();
                    banner.active = false;
                    if (cc.RedT && cc.RedT.inGame && cc.RedT.inGame.dialog) {
                        cc.RedT.inGame.dialog.showTopHuTx();
                    }
                });
            }
            banner.removeAllChildren();
            banner.active = true;
            banner.stopAllActions();
            banner.scale = 0.6;
            banner.opacity = 255;
            var tpl = getNativeUITemplates();
            banner.addChild(createStyledCapsule(560, 62, tpl));
            if (tpl.tplIconBtn) {
                var jpIc = cc.instantiate(tpl.tplIconBtn);
                jpIc.active = true;
                jpIc.setPosition(-245, 0);
                jpIc.setScale(0.95, 0.95);
                var jbComp = jpIc.getComponent(cc.Button);
                if (jbComp) {
                    jbComp.clickEvents = [];
                    jbComp.enabled = false;
                    jpIc.removeComponent(cc.Button);
                }
                banner.addChild(jpIc);
            }
            banner.addChild(createStyledLabel('NỔ HŨ #' + phien + ' (' + (isXiu ? '1-1-1 XỈU' : '6-6-6 TÀI') + ') : $ ' + numberWithCommas(quyhu), -210, 11, 16, false, 'left', tpl));
            banner.addChild(createStyledLabel('Tổng số người trúng hũ : ' + tonguser + ' người', -210, -12, 15, true, 'left', tpl));
            banner.addChild(createStyledActionButton('Xem Vinh Danh', 190, 0, 148, 46, tpl, function (ev) {
                if (ev && ev.stopPropagation) ev.stopPropagation();
                banner.active = false;
                if (cc.RedT && cc.RedT.inGame && cc.RedT.inGame.dialog) {
                    cc.RedT.inGame.dialog.showTopHuTx();
                }
            }));
            banner.runAction(cc.sequence(cc.scaleTo(0.25, 1.05), cc.scaleTo(0.15, 1.0)));
            clearTimeout(banner._hideTimer);
            banner._hideTimer = setTimeout(function () {
                if (banner && banner.isValid) banner.active = false;
            }, 8500);

            // 3. Nếu bảng SĂN HŨ (TopHuTx) đang mở -> tự động tải lại phiên nổ hũ mới nhất
            var topHuComp = cc.RedT && cc.RedT.inGame && cc.RedT.inGame.dialog && cc.RedT.inGame.dialog.TopHuTx;
            if (topHuComp && topHuComp.node && topHuComp.node.active) {
                setTimeout(function () { topHuComp.get_data(); }, 400);
            }
        } catch (e) {
            warn(e);
        }
    }

    // ------------------------------------------------------------------ Public API
    window.MD5Mode = {
        getInstance: function () {
            return S.tx;
        },
        initMiniPanel: function (miniPanel) {
            try {
                S.miniPanel = miniPanel;
                setupMD5Instance(miniPanel);
                setTimeout(addMiniGameWheelIcon, 300);
                setTimeout(hideMaintenanceLobbyGames, 300);
                setTimeout(setupLobbyMenuAndAudio, 300);
                setTimeout(wireNormalTaiXiuJackpotHeader, 300);
                setTimeout(hookNormalTaiXiuReveal, 300);
                setTimeout(function () { updateSanHuHeaderAndDialog(S.currentHuTx); }, 400);
            } catch (e) {
                warn(e);
            }
        },
        open: function () {
            try {
                addMiniGameWheelIcon();
                if (!S.tx && cc.RedT && cc.RedT.MiniPanel) {
                    this.initMiniPanel(cc.RedT.MiniPanel);
                }
                if (!S.tx) return;
                S.tx.openGame();
            } catch (e) {
                warn(e);
            }
        },
        beforeOpen: function () {
            // Khi mở bàn Tài Xỉu thường mà bàn MD5 đang mở ở cùng vị trí -> dịch nhẹ để cả 2 bàn hiển thị song song
            try {
                wireNormalTaiXiuJackpotHeader();
        hookNormalTaiXiuReveal();
                hookNormalTaiXiuReveal();
                updateSanHuHeaderAndDialog(S.currentHuTx);
                if (!S.tx || !S.tx.node.active || !S.miniPanel || !S.miniPanel.TaiXiu) return;
                var origMain = S.miniPanel.TaiXiu.TX_Main;
                var md5Main = S.tx.TX_Main;
                if (origMain && md5Main) {
                    S.miniPanel.TaiXiu.node.scale = 1;
                    S.tx.node.scale = 1;
                    var dx = Math.abs(md5Main.node.x - origMain.node.x);
                    var dy = Math.abs(md5Main.node.y - origMain.node.y);
                    if (dx < 80 && dy < 80) {
                        origMain.node.position = cc.v2(-200, 75);
                        md5Main.node.position = cc.v2(190, -65);
                        setting().position = md5Main.node.position;
                    }
                }
            } catch (e) {}
        },
        onClose: function () {},
        signIn: function () {
            addMiniGameWheelIcon();
            hideMaintenanceLobbyGames();
            setupLobbyMenuAndAudio();
            wireNormalTaiXiuJackpotHeader();
            hookNormalTaiXiuReveal();
            try {
                if (cc.RedT && typeof cc.RedT.send === 'function') {
                    var isMd5Open = !!(S.tx && S.tx.node && S.tx.node.active);
                    cc.RedT.send({taixiumd5: {view: isMd5Open, getLogs: true}});
                    var isNormalOpen = !!(cc.RedT.MiniPanel && cc.RedT.MiniPanel.TaiXiu && cc.RedT.MiniPanel.TaiXiu.node && cc.RedT.MiniPanel.TaiXiu.node.active);
                    cc.RedT.send({taixiu: {view: isNormalOpen, getLogs: true}});
                }
            } catch (e) {}
        },
        newGame: function () {
            if (S.tx) S.tx.newGame();
        },
        onDestroy: function () {
            if (S.tx && S.tx.TX_Main) {
                clearInterval(S.tx.TX_Main.timeInterval);
                clearTimeout(S.tx.TX_Main.regTimeOut);
                clearTimeout(S.tx.TX_Main.regTimeOut2);
            }
        },
        openNhiemVu: function (comp) {
            renderNhiemVuUI(comp, comp && comp._lastData);
        },
        renderNhiemVu: function (comp, data) {
            renderNhiemVuUI(comp, data);
        },
        syncHuTx: function (amount) {
            updateSanHuHeaderAndDialog(amount);
        },
        onTaiXiuJackpot: function (txMain, jpData) {
            triggerNormalTaiXiuJackpotEffect(txMain, jpData);
        },
        onSocket: function (e) {
            try {
                if (!e) return;
                if (e.taixiumd5) {
                    if (e.taixiumd5.finish || e.taixiumd5.status) {
                        S.md5WaitingReveal = true;
                        S.md5Revealed = false;
                    }
                }
                if (e.taixiu) {
                    if (e.taixiu.finish || e.taixiu.status) {
                        S.normalWaitingReveal = true;
                    }
                }
                if (e.user) {
                    var trMd5 = setting().time_remain;
                    var trTx = (cc.RedT && cc.RedT.setting && cc.RedT.setting.taixiu && cc.RedT.setting.taixiu.time_remain) || 0;
                    var md5Active = !!(S.tx && S.tx.node && S.tx.node.active);
                    var normalTxActive = !!(cc.RedT && cc.RedT.MiniPanel && cc.RedT.MiniPanel.TaiXiu && cc.RedT.MiniPanel.TaiXiu.node && cc.RedT.MiniPanel.TaiXiu.node.active);

                    var isSettlementWaiting = !!(e._txSettle || e._txSource) ||
                        S.md5WaitingReveal ||
                        S.normalWaitingReveal ||
                        (md5Active && !S.md5Revealed && trMd5 > 46) ||
                        (normalTxActive && trTx > 46);

                    if (isSettlementWaiting && e.user.red !== undefined) {
                        S.pendingUserRed = e.user.red;
                        delete e.user.red;
                        if (Object.keys(e.user).length === 0) {
                            delete e.user;
                        }
                    } else {
                        syncUserBalances(e.user);
                        setTimeout(function () { syncUserBalances(e.user); }, 50);
                    }
                }
                if (e && e.hutxmain && e.hutxmain.monney !== undefined) {
                    updateSanHuHeaderAndDialog(e.hutxmain.monney);
                }
                if (e && e.taixiu) {
                    if (e.taixiu.hutx && e.taixiu.hutx.monney !== undefined) {
                        updateSanHuHeaderAndDialog(e.taixiu.hutx.monney);
                    }
                    if (e.taixiu.jackpot) {
                        triggerNormalTaiXiuJackpotEffect(null, e.taixiu.jackpot);
                    }
                    if ((e.taixiu.sync_time !== undefined || e.taixiu.sync_phien !== undefined) && cc.RedT && cc.RedT.MiniPanel && cc.RedT.MiniPanel.TaiXiu && cc.RedT.MiniPanel.TaiXiu.TX_Main) {
                        hookNormalTaiXiuReveal();
                        cc.RedT.MiniPanel.TaiXiu.TX_Main.onData({sync_time: e.taixiu.sync_time, sync_phien: e.taixiu.sync_phien});
                        delete e.taixiu.sync_time;
                        delete e.taixiu.sync_phien;
                    }
                }
                if (!e || e.taixiumd5 === undefined) return;
                var d = e.taixiumd5;
                delete e.taixiumd5;
                if (d.finish) {
                    S.md5WaitingReveal = true;
                    S.md5Revealed = false;
                }
                if (d.md5) {
                    if (d.md5.hash !== undefined) {
                        S.pendingLastHash = d.md5.hash;
                        if (S.md5Revealed || setting().time_remain <= 46) {
                            S.lastHash = d.md5.hash;
                        }
                    }
                    if (d.md5.tx !== undefined) {
                        S.pendingNextMd5 = d.md5.tx;
                        if (S.md5Revealed || setting().time_remain <= 46) {
                            S.md5tx = d.md5.tx;
                            S.currentRoundMd5 = d.md5.tx;
                        }
                    }
                }
                if (d.taixiu) {
                    updateLobbyMD5Totals(d.taixiu);
                }
                if (S.tx && S.tx.TX_Main) {
                    S.tx.TX_Main.onData(d);
                }
                refreshMd5Row();
            } catch (er) {
                warn(er);
            }
        },
        isOn: function () {
            return !!(S.tx && S.tx.node && S.tx.node.active);
        },
    };

    function resyncActiveTables() {
        try {
            if (!cc.RedT || typeof cc.RedT.send !== 'function') return;
            if (cc.RedT._socket && cc.RedT._socket.readyState !== 1) {
                if (typeof cc.RedT.reconnect === 'function') cc.RedT.reconnect();
                return;
            }
            var isMd5Open = !!(S.tx && S.tx.node && S.tx.node.active);
            var isNormalOpen = !!(cc.RedT.MiniPanel && cc.RedT.MiniPanel.TaiXiu && cc.RedT.MiniPanel.TaiXiu.node && cc.RedT.MiniPanel.TaiXiu.node.active);
            cc.RedT.send({taixiumd5: {view: isMd5Open, getLogs: true}});
            if (isNormalOpen) {
                cc.RedT.send({taixiu: {view: true, getLogs: true}});
            }
        } catch (e) {}
    }

    if (typeof document !== 'undefined' && document.addEventListener) {
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) {
                setTimeout(resyncActiveTables, 150);
            }
        });
    }
    if (typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('focus', function () {
            setTimeout(resyncActiveTables, 150);
        });
    }

    setInterval(function () {
        hideMaintenanceLobbyGames();
        setupLobbyMenuAndAudio();
        wireNormalTaiXiuJackpotHeader();
        hookNormalTaiXiuReveal();
        updateSanHuHeaderAndDialog(S.currentHuTx);
        addMiniGameWheelIcon();
        try {
            if (cc.RedT && cc.RedT._socket && cc.RedT._socket.readyState === 1) {
                var nowW = Date.now();
                if (S.tx && S.tx.node && S.tx.node.active && S.tx.TX_Main) {
                    var stM = setting();
                    if (!S.tx.TX_Main.timeInterval || stM.time_remain === undefined || stM.time_remain < 0 || !stM.getLogs) {
                        if (!S._lastWatchdogMd5 || nowW - S._lastWatchdogMd5 > 3000) {
                            S._lastWatchdogMd5 = nowW;
                            cc.RedT.send({taixiumd5: {view: true, getLogs: true}});
                        }
                    }
                }
                if (cc.RedT.MiniPanel && cc.RedT.MiniPanel.TaiXiu && cc.RedT.MiniPanel.TaiXiu.node && cc.RedT.MiniPanel.TaiXiu.node.active && cc.RedT.MiniPanel.TaiXiu.TX_Main) {
                    var stN = cc.RedT.setting && cc.RedT.setting.taixiu;
                    var txM = cc.RedT.MiniPanel.TaiXiu.TX_Main;
                    if (stN && (!txM.timeInterval || stN.time_remain === undefined || stN.time_remain < 0 || !stN.getLogs)) {
                        if (!S._lastWatchdogTx || nowW - S._lastWatchdogTx > 3000) {
                            S._lastWatchdogTx = nowW;
                            cc.RedT.send({taixiu: {view: true, getLogs: true}});
                        }
                    }
                }
            }
        } catch (e) {}
    }, 1000);
})();
