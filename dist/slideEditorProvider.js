"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlideStudioEditorProvider = void 0;
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const cp = require("child_process");
/**
 * SlideStudioEditorProvider:
 * *.slide.json 파일을 열었을 때 네이티브 WYSIWYG 에디터를 띄우고
 * AI 에이전트와 사용자 조작을 실시간 양방향으로 동기화합니다.
 */
class SlideStudioEditorProvider {
    static register(context) {
        const provider = new SlideStudioEditorProvider(context);
        return vscode.window.registerCustomEditorProvider(SlideStudioEditorProvider.viewType, provider, {
            webviewOptions: {
                retainContextWhenHidden: true
            },
            supportsMultipleEditorsPerDocument: false
        });
    }
    constructor(context) {
        this.context = context;
    }
    async resolveCustomTextEditor(document, webviewPanel, _token) {
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(this.context.extensionPath, 'media'))
            ]
        };
        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview, document);
        const norm = (s) => s.replace(/\r\n/g, '\n');
        // 웹뷰가 마지막으로 파일에 쓴(또는 웹뷰로 전달한) 정규화 텍스트. 이 값과 같은 변경 이벤트는 에코로 간주해 무시한다.
        let lastWritten = '';
        let writeQueue = Promise.resolve();
        const initialText = norm(document.getText());
        // 웹뷰 → 문서 쓰기를 직렬화해, 겹친 저장이 서로의 에코를 외부 수정으로 오인하지 않게 한다
        const writeFromWebview = (deck) => {
            writeQueue = writeQueue.then(async () => {
                const json = this.serializeDeck(deck);
                lastWritten = json;
                if (norm(document.getText()) === json)
                    return;
                await this.replaceDocumentText(document, json);
            }).catch(err => console.warn('문서 쓰기 실패:', err));
            return writeQueue;
        };
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() !== document.uri.toString())
                return;
            if (e.contentChanges.length === 0)
                return; // 저장/dirty 상태 변경 이벤트
            const text = norm(e.document.getText());
            if (text === lastWritten)
                return; // 웹뷰 자신이 방금 쓴 내용 → 에코 차단
            if (!text.trim())
                return;
            try {
                const data = JSON.parse(text);
                lastWritten = text; // 이후 같은 내용으로 되돌리는 수정도 정상 전달되도록 갱신
                webviewPanel.webview.postMessage({ type: 'updateDoc', deck: data });
            }
            catch (err) {
                // 에이전트가 쓰는 도중의 불완전한 JSON은 무시하고 다음 변경을 기다린다
            }
        });
        let actionWatcher;
        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
            actionWatcher?.dispose();
        });
        const baseDir = this.getBaseDir(document);
        // 에이전트 원격 명령 감시 (.slide-src/agent_action.json)
        if (baseDir) {
            try {
                const actionPattern = new vscode.RelativePattern(baseDir, '.slide-src/agent_action.json');
                actionWatcher = vscode.workspace.createFileSystemWatcher(actionPattern);
                const handleAgentAction = async () => {
                    try {
                        const actionPath = path.join(baseDir, '.slide-src', 'agent_action.json');
                        if (fs.existsSync(actionPath)) {
                            const content = await fs.promises.readFile(actionPath, 'utf-8');
                            const action = JSON.parse(content);
                            if (action && action.action === 'gotoSlide') {
                                webviewPanel.webview.postMessage({
                                    type: 'gotoSlide',
                                    slideIndex: typeof action.slideIndex === 'number' ? action.slideIndex : (action.slideNumber ? action.slideNumber - 1 : 0),
                                    slideNumber: action.slideNumber
                                });
                            }
                            await fs.promises.unlink(actionPath).catch(() => { });
                        }
                    }
                    catch (err) { }
                };
                actionWatcher.onDidCreate(handleAgentAction);
                actionWatcher.onDidChange(handleAgentAction);
            }
            catch (err) { }
        }
        const deckBase = path.basename(document.fileName).replace(/\.slide\.json$/i, '');
        const backupPrefix = `${deckBase.replace(/[^a-zA-Z0-9가-힣_-]/g, '_')}_backup_`;
        const backupDir = baseDir ? path.join(baseDir, '.slide-src', 'backups') : undefined;
        const postBackupList = async () => {
            webviewPanel.webview.postMessage({ type: 'backupList', items: await this.listBackups(backupDir, backupPrefix) });
        };
        const isValidBackupName = (name) => name.startsWith(backupPrefix) && name.endsWith('.slide.json') && path.basename(name) === name;
        const saveScreenshotFile = async (screenshotData, pageNum) => {
            if (!baseDir || !screenshotData || typeof screenshotData !== 'string' || !screenshotData.startsWith('data:image/'))
                return;
            try {
                const cacheDir = path.join(baseDir, '.slide-src', 'cache');
                await fs.promises.mkdir(cacheDir, { recursive: true });
                const base64Data = screenshotData.replace(/^data:image\/\w+;base64,/, '');
                const buffer = Buffer.from(base64Data, 'base64');
                // 최신 뷰포트 미리보기 저장
                await fs.promises.writeFile(path.join(cacheDir, 'preview.png'), buffer);
                // 해당 슬라이드 번호별 캡처 저장 (page1.png, page2.png 등)
                const pNum = Math.max(1, Math.floor(Number(pageNum)) || 1);
                await fs.promises.writeFile(path.join(cacheDir, `page${pNum}.png`), buffer);
            }
            catch (err) {
                console.warn('스크린샷 캐시 저장 실패:', err);
            }
        };
        webviewPanel.webview.onDidReceiveMessage(async (e) => {
            switch (e.type) {
                case 'ready':
                    // 초기 데이터는 HTML에 이미 포함되어 있다. 그 사이 문서가 바뀐 경우에만 다시 보낸다.
                    try {
                        const text = norm(document.getText());
                        if (text.trim() && text !== initialText && text !== lastWritten) {
                            webviewPanel.webview.postMessage({ type: 'updateDoc', deck: JSON.parse(text), isInitialLoad: true });
                        }
                    }
                    catch (err) { }
                    return;
                case 'sessionState':
                    if (baseDir && e.state) {
                        try {
                            const srcDir = path.join(baseDir, '.slide-src');
                            if (!fs.existsSync(srcDir)) {
                                await fs.promises.mkdir(srcDir, { recursive: true });
                            }
                            const statePath = path.join(srcDir, 'session_state.json');
                            const stateData = {
                                file: path.basename(document.fileName),
                                ...e.state
                            };
                            await fs.promises.writeFile(statePath, JSON.stringify(stateData, null, 2), 'utf-8');
                        }
                        catch (err) {
                            console.warn('세션 상태 저장 실패:', err);
                        }
                    }
                    return;
                case 'slideModified':
                    await writeFromWebview(e.deck);
                    return;
                case 'manualSave':
                    await writeFromWebview(e.deck);
                    await document.save();
                    if (e.screenshot) {
                        await saveScreenshotFile(e.screenshot, e.slideNumber || 1);
                    }
                    return;
                case 'saveSlideCapture':
                    // 슬라이드 전환 또는 편집 시 실시간 비동기 캡처 자동 저장
                    if (e.screenshot) {
                        await saveScreenshotFile(e.screenshot, e.slideNumber || 1);
                    }
                    return;
                case 'exportPPTX':
                    if (typeof e.base64 === 'string' && typeof e.fileName === 'string') {
                        try {
                            const outDir = baseDir || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                            if (!outDir) {
                                vscode.window.showErrorMessage('PPTX를 저장할 폴더를 찾을 수 없습니다. 파일을 먼저 저장하거나 폴더를 여세요.');
                                return;
                            }
                            // 경로 구분자·제어문자·예약 문자를 제거하고 항상 .pptx 확장자로 저장
                            let safeName = path.basename(e.fileName).replace(/[\\/?%*:|"<>\x00-\x1f]/g, '_').trim() || 'Presentation';
                            if (!/\.pptx$/i.test(safeName))
                                safeName += '.pptx';
                            const pptxPath = path.join(outDir, safeName);
                            await fs.promises.writeFile(pptxPath, Buffer.from(e.base64, 'base64'));
                            const pick = await vscode.window.showInformationMessage(`PPTX 내보내기 성공! '${safeName}' 파일이 생성되었습니다.`, '폴더에서 보기');
                            if (pick) {
                                vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(pptxPath));
                            }
                        }
                        catch (err) {
                            vscode.window.showErrorMessage(`PPTX 내보내기 실패: ${err.message}`);
                        }
                    }
                    return;
                case 'createBackupFile':
                    // .slide-src/backups/ 에 백업 보관 (파일명은 호스트가 생성하므로 경로 조작이 불가능하다)
                    if (backupDir && e.deck) {
                        try {
                            await this.createBackup(backupDir, backupPrefix, e.kind, this.serializeDeck(e.deck));
                            await postBackupList();
                        }
                        catch (err) {
                            console.warn('백업 파일 생성 실패:', err);
                        }
                    }
                    return;
                case 'listBackups':
                    await postBackupList();
                    return;
                case 'restoreBackupFile':
                    if (backupDir && typeof e.fileName === 'string' && isValidBackupName(e.fileName)) {
                        try {
                            const raw = await fs.promises.readFile(path.join(backupDir, e.fileName), 'utf-8');
                            webviewPanel.webview.postMessage({ type: 'backupData', fileName: e.fileName, deck: JSON.parse(raw) });
                        }
                        catch (err) {
                            vscode.window.showErrorMessage(`백업 복원 실패: ${err.message}`);
                        }
                    }
                    return;
                case 'deleteBackupFile':
                    if (backupDir && typeof e.fileName === 'string' && isValidBackupName(e.fileName)) {
                        try {
                            await fs.promises.unlink(path.join(backupDir, e.fileName));
                        }
                        catch (err) { }
                        await postBackupList();
                    }
                    return;
                case 'pruneBackups':
                    if (backupDir) {
                        await this.pruneBackups(backupDir, backupPrefix, Math.max(1, Math.min(30, Number(e.keep) || 5)));
                        await postBackupList();
                    }
                    return;
                case 'scanSystemFonts': {
                    try {
                        const fonts = await this.getSystemFonts();
                        webviewPanel.webview.postMessage({ type: 'systemFontsScanned', fonts, source: 'host' });
                    }
                    catch (err) {
                        console.warn('시스템 폰트 스캔 오류:', err);
                        webviewPanel.webview.postMessage({ type: 'systemFontsScanned', fonts: [], source: 'host', error: String((err && err.message) || err) });
                    }
                    return;
                }
            }
        });
    }
    getSystemFonts() {
        if (!SlideStudioEditorProvider.fontsPromise) {
            // 실패 결과는 캐시하지 않아 다음 시도에서 다시 조회한다
            SlideStudioEditorProvider.fontsPromise = this.scanSystemFonts().catch(err => {
                SlideStudioEditorProvider.fontsPromise = undefined;
                throw err;
            });
        }
        return SlideStudioEditorProvider.fontsPromise;
    }
    runTool(file, args) {
        return new Promise((resolve, reject) => {
            cp.execFile(file, args, { windowsHide: true, encoding: 'buffer', timeout: 10000, maxBuffer: 16 * 1024 * 1024 }, (err, stdout) => {
                // reg.exe는 1이 아닌 종료 코드와 함께 일부 출력을 낼 수 있으므로 출력이 있으면 사용한다
                if (stdout && stdout.length > 0)
                    resolve(stdout);
                else
                    reject(err || new Error('빈 출력'));
            });
        });
    }
    // reg.exe는 콘솔 코드 페이지(한국어 Windows는 CP949)로 출력하므로 UTF-8로 먼저 시도하고 실패하면 CP949로 해석한다
    decodeConsoleOutput(buf) {
        try {
            return new TextDecoder('utf-8', { fatal: true }).decode(buf);
        }
        catch (e) {
            try {
                return new TextDecoder('euc-kr').decode(buf);
            }
            catch (e2) {
                return buf.toString('latin1');
            }
        }
    }
    async scanSystemFonts() {
        const names = new Set();
        const add = (raw) => {
            let name = raw.replace(/\s*\([^)]*\)\s*$/, '').trim(); // "(TrueType)", "(OpenType)" 접미사 제거
            if (!name || name.startsWith('@'))
                return; // 세로쓰기 폰트 제외
            // 레지스트리에는 굵게/기울임이 별도 항목("Arial Bold")으로 있으므로 패밀리 이름만 남긴다
            name = name.replace(/\s+(Bold Italic|Bold Oblique|Bold|Italic|Oblique)$/i, '').trim();
            if (name)
                names.add(name);
        };
        if (process.platform === 'win32') {
            // 셸을 거치지 않고 절대 경로로 실행한다 (PATH에 System32가 없거나 공백 경로 인용 문제가 생기지 않도록)
            const reg = path.join(process.env.SystemRoot || process.env.windir || 'C:\\Windows', 'System32', 'reg.exe');
            const keys = [
                'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts',
                'HKCU\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts'
            ];
            const outputs = await Promise.all(keys.map(k => this.runTool(reg, ['query', k]).then(b => this.decodeConsoleOutput(b), () => '')));
            for (const out of outputs) {
                for (const line of out.split(/\r?\n/)) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith('HKEY_'))
                        continue;
                    const m = /^(.*?)\s{2,}REG_\w+\s+/.exec(trimmed);
                    if (!m)
                        continue;
                    m[1].split(' & ').forEach(add); // "MS Gothic & MS UI Gothic & MS PGothic" 같은 결합 항목 분리
                }
            }
            // 한국어 사용자에게 익숙한 이름으로 바꾼다 (영문 원본은 중복 표시를 막기 위해 제거)
            const ko = [
                ['Malgun Gothic', '맑은 고딕'], ['Gulim', '굴림'], ['GulimChe', '굴림체'], ['Dotum', '돋움'], ['DotumChe', '돋움체'],
                ['Batang', '바탕'], ['BatangChe', '바탕체'], ['Gungsuh', '궁서'], ['GungsuhChe', '궁서체'],
                ['NanumGothic', '나눔고딕'], ['Nanum Gothic', '나눔고딕'], ['NanumMyeongjo', '나눔명조'], ['Nanum Myeongjo', '나눔명조'],
                ['NanumSquare', '나눔스퀘어'], ['NanumSquareRound', '나눔스퀘어 라운드'], ['NanumBarunGothic', '나눔바른고딕']
            ];
            ko.forEach(([en, kr]) => {
                if (names.has(en)) {
                    names.delete(en);
                    names.add(kr);
                }
            });
        }
        else {
            try {
                const out = (await this.runTool('fc-list', [':', 'family'])).toString('utf-8');
                out.split(/\r?\n/).forEach(line => line.split(',')[0] && add(line.split(',')[0]));
            }
            catch (e) {
                // fc-list가 없는 환경에서는 빈 목록을 반환하고, 웹뷰가 자체 감지로 대체한다
            }
        }
        if (names.size === 0) {
            throw new Error(process.platform === 'win32'
                ? '레지스트리에서 폰트 목록을 읽지 못했습니다 (reg.exe 실행 실패)'
                : '폰트 목록을 읽지 못했습니다 (fc-list를 사용할 수 없음)');
        }
        return Array.from(names).sort((a, b) => a.localeCompare(b, 'ko'));
    }
    getBaseDir(document) {
        return document.uri.scheme === 'file' ? path.dirname(document.uri.fsPath) : undefined;
    }
    async listBackups(backupDir, prefix) {
        if (!backupDir)
            return [];
        let names = [];
        try {
            names = (await fs.promises.readdir(backupDir)).filter(n => n.startsWith(prefix) && n.endsWith('.slide.json'));
        }
        catch (err) {
            return [];
        }
        const stats = await Promise.all(names.map(async (name) => ({ name, st: await fs.promises.stat(path.join(backupDir, name)) })));
        stats.sort((a, b) => b.st.mtimeMs - a.st.mtimeMs);
        return Promise.all(stats.slice(0, 30).map(async ({ name, st }) => {
            let title = '';
            let slidesCount = 0;
            try {
                const deck = JSON.parse(await fs.promises.readFile(path.join(backupDir, name), 'utf-8'));
                title = typeof deck.title === 'string' ? deck.title : '';
                slidesCount = Array.isArray(deck.slides) ? deck.slides.length : 0;
            }
            catch (err) { }
            const kind = /_(save|manual|prerestore)\.slide\.json$/.exec(name)?.[1] || 'save';
            return { fileName: name, timestamp: st.mtime.toISOString(), title, slidesCount, kind };
        }));
    }
    async createBackup(backupDir, prefix, kind, json) {
        const safeKind = ['save', 'manual', 'prerestore'].includes(kind) ? kind : 'save';
        await fs.promises.mkdir(backupDir, { recursive: true });
        const d = new Date();
        const p = (n) => String(n).padStart(2, '0');
        const stamp = `${String(d.getFullYear()).slice(-2)}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
        let fileName = `${prefix}${stamp}_${safeKind}.slide.json`;
        for (let i = 2; fs.existsSync(path.join(backupDir, fileName)); i++) {
            fileName = `${prefix}${stamp}-${i}_${safeKind}.slide.json`; // 같은 초에 여러 번 저장해도 덮어쓰지 않는다
        }
        await fs.promises.writeFile(path.join(backupDir, fileName), json, 'utf-8');
        await this.pruneBackups(backupDir, prefix, 30);
        return fileName;
    }
    async pruneBackups(backupDir, prefix, keep) {
        const items = await this.listBackups(backupDir, prefix);
        // listBackups는 상한 30개만 반환하므로, 상한을 넘는 오래된 파일도 정리하려면 전체 목록이 필요하다
        let names = [];
        try {
            names = (await fs.promises.readdir(backupDir)).filter(n => n.startsWith(prefix) && n.endsWith('.slide.json'));
        }
        catch (err) {
            return;
        }
        const keepSet = new Set(items.slice(0, keep).map(i => i.fileName));
        await Promise.all(names.filter(n => !keepSet.has(n)).map(n => fs.promises.unlink(path.join(backupDir, n)).catch(() => { })));
    }
    sanitizeDeckForSaving(deck) {
        if (!deck || typeof deck !== 'object')
            return deck;
        try {
            const cleanDeck = JSON.parse(JSON.stringify(deck));
            if (Array.isArray(cleanDeck.slides)) {
                cleanDeck.slides.forEach((s) => {
                    delete s.thumbnail; // base64 썸네일 속성 영구 제거하여 파일 초경량화
                });
            }
            return cleanDeck;
        }
        catch (e) {
            return deck;
        }
    }
    serializeDeck(deck) {
        // 직렬화 결과는 항상 \n 줄바꿈이다. 비교할 때는 문서 텍스트도 \n으로 정규화해야 한다.
        return JSON.stringify(this.sanitizeDeckForSaving(deck), null, 2);
    }
    async replaceDocumentText(document, jsonString) {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), jsonString);
        await vscode.workspace.applyEdit(edit);
    }
    getHtmlForWebview(webview, document) {
        const cssUri = webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'editor.css')));
        const jsUri = webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'editor.js')));
        const vendorUri = (file) => webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'vendor', file)));
        const fabricUri = vendorUri('fabric.min.js');
        const pptxUri = vendorUri('pptxgen.bundle.js');
        // 외부 네트워크 접근을 모두 차단한다. 에디터가 인라인 핸들러(onclick 등)를 쓰므로 script/style은 'unsafe-inline'이 필요하다.
        const csp = [
            "default-src 'none'",
            `img-src ${webview.cspSource} data: blob:`,
            `media-src ${webview.cspSource} data: blob:`,
            `style-src ${webview.cspSource} 'unsafe-inline' https://cdn.jsdelivr.net`, // UI 글꼴(Pretendard) CSS
            `script-src ${webview.cspSource} 'unsafe-inline'`,
            `font-src ${webview.cspSource} data: https://cdn.jsdelivr.net`
        ].join('; ');
        const initialJson = document.getText() || '{}';
        // JSON 문자열 밖에는 '<'가 없으므로 전부 \\u003c로 바꿔도 안전하다 (</script, <!-- 모두 차단)
        const safeJsonString = initialJson.replace(/</g, '\\u003c');
        const baseName = path.basename(document.fileName).replace(/\.slide\.json$/i, '')
            .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Co-Slide</title>
  <link rel="stylesheet" href="${cssUri}">
  <script src="${fabricUri}"></script>
  <script src="${pptxUri}"></script>
</head>
<body>
  <header class="top-header">
    <div class="title-row">
      <div class="brand-section">
        <span class="brand-badge">Co-Slide</span>
        <div class="doc-title-editor">
          <input type="text" id="projectTitleInput" class="project-title-input" value="${baseName}" oninput="updateProjectTitle(this.value)">
          <span class="file-ext">.slide.json</span>
        </div>
      </div>
      <div class="top-actions">
        <div class="history-controls" style="display: flex; gap: 4px; align-items: center; margin-right: 8px;">
          <button class="undo-btn" id="btnUndo" onclick="undo()" title="실행 취소 (Ctrl+Z)" disabled>↩ 취소</button>
          <button class="undo-btn" id="btnRedo" onclick="redo()" title="다시 실행 (Ctrl+Y)" disabled>↪ 다시</button>
        </div>
        <button class="btn-icon btn-save" id="btnSave" onclick="handleManualSave()" title="저장">💾 저장</button>
        <button class="btn-icon btn-history" id="btnHistory" onclick="openHistoryModal()" title="버전 기록 및 백업 복원">📜 기록</button>
        <div class="zoom-controls">
          <button class="zoom-btn" onclick="zoomOut()" title="축소">-</button>
          <span class="zoom-indicator" id="zoomVal">55%</span>
          <button class="zoom-btn" onclick="zoomIn()" title="확대">+</button>
          <button class="zoom-btn" onclick="adjustZoomFit()" title="화면 맞춤" style="border-left: 1px solid #475569;">맞춤</button>
        </div>
        <button class="btn-icon btn-primary" onclick="exportToPPTX()">🚀 PPTX 내보내기</button>
      </div>
    </div>

    <!-- 메뉴 바 1 (첫째줄): 삽입 도구 + X / Y / 너비 / 높이 -->
    <div class="menu-row menu-row-1">
      <div class="menu-group">
        <button class="tool-btn" onclick="insertText()">🔤 텍스트 상자</button>
        <button class="tool-btn dropdown-trigger-btn" id="shapeDropdownTrigger" onclick="toggleShapePopover(event)">⬚ 도형 ▼</button>
        <button class="tool-btn dropdown-trigger-btn" id="tableDropdownTrigger" onclick="toggleTablePopover(event)">⊞ 표 삽입 ▼</button>
        <button class="tool-btn dropdown-trigger-btn" id="mediaDropdownTrigger" onclick="toggleMediaPopover(event)">🎬 미디어 삽입 ▼</button>
      </div>

      <div class="toolbar-divider-v"></div>

      <div class="menu-group prop-pos-size-group">
        <span class="prop-inline-label">X:</span>
        <input type="number" class="prop-compact-input" id="propX" oninput="changePropPos('x', this.value, false)" onchange="changePropPos('x', this.value, true)" placeholder="0" title="선택 개체 X 좌표">
        <span class="prop-inline-label">Y:</span>
        <input type="number" class="prop-compact-input" id="propY" oninput="changePropPos('y', this.value, false)" onchange="changePropPos('y', this.value, true)" placeholder="0" title="선택 개체 Y 좌표">
        <span class="prop-inline-label">너비:</span>
        <input type="number" class="prop-compact-input" id="propW" oninput="changePropSize('w', this.value, false)" onchange="changePropSize('w', this.value, true)" placeholder="0" title="선택 개체 너비">
        <span class="prop-inline-label">높이:</span>
        <input type="number" class="prop-compact-input" id="propH" oninput="changePropSize('h', this.value, false)" onchange="changePropSize('h', this.value, true)" placeholder="0" title="선택 개체 높이">
      </div>
    </div>

    <!-- 메뉴 바 2 (둘째줄): 서식 / 폰트검색 / 폰트드롭다운 / 폰트스캔 / 크기숫자입력 / A+ A- 볼드 이탤릭 밑줄 / 정렬 -->
    <div class="format-row disabled" id="formatRow">
      <span class="group-label" style="color: #38BDF8; font-weight: 700;">서식</span>
      
      <input type="text" class="font-search-input" id="fontSearchInput" placeholder="폰트 검색..." oninput="filterFontList(this.value)" title="폰트 이름 실시간 검색">
      <select class="font-select" id="fontFamilySelect" onchange="changeFontFamily(this.value)">
        <option value="맑은 고딕">맑은 고딕</option>
      </select>
      <button class="tool-btn" id="btnScanFonts" onclick="scanLocalFonts()" title="내 컴퓨터 폰트 전체 스캔" style="padding: 3px 6px;">🔍 폰트 스캔</button>

      <div class="toolbar-divider-v"></div>

      <input type="number" class="size-input" id="fontSizeInput" min="8" max="144" value="24" oninput="changeFontSize(this.value, false)" onchange="changeFontSize(this.value, true)" title="글자 크기 직접 입력">
      <button class="tool-btn" onclick="stepFontSize(2)" title="글자 크게 (A+)">A⁺</button>
      <button class="tool-btn" onclick="stepFontSize(-2)" title="글자 작게 (A-)">A⁻</button>

      <div class="toolbar-divider-v"></div>

      <button class="tool-btn" id="btnBold" onclick="toggleBold()" style="font-weight: bold;">B</button>
      <button class="tool-btn" id="btnItalic" onclick="toggleItalic()" style="font-style: italic;">I</button>
      <button class="tool-btn" id="btnUnderline" onclick="toggleUnderline()" style="text-decoration: underline;">U</button>

      <div class="toolbar-divider-v"></div>

      <button class="tool-btn" onclick="setTextAlign('left')">좌측</button>
      <button class="tool-btn" onclick="setTextAlign('center')">가운데</button>
      <button class="tool-btn" onclick="setTextAlign('right')">우측</button>
    </div>

    <!-- 메뉴 바 3 (셋째줄): 글자색 / 배경색 / 테두리색 / 테두리굵기숫자입력 / 투명도숫자입력 -->
    <div class="menu-row-3" id="styleRow">
      <!-- 글자색 팝오버 -->
      <div class="color-picker-btn-wrapper">
        <button class="color-trigger-btn" id="textColorTrigger" onclick="toggleColorPopover('text', event)" title="글자색 변경">
          <span class="color-preview-bar" id="textColorBar" style="background:#FFFFFF;"></span>
          <span>글자색 ▼</span>
        </button>
      </div>

      <!-- 통합 배경색 팝오버: 개체 미선택 시 슬라이드 배경색, 개체 선택 시 해당 개체/셀 배경색 -->
      <div class="color-picker-btn-wrapper">
        <button class="color-trigger-btn" id="unifiedBgTrigger" onclick="handleUnifiedBgClick(event)" title="배경색 (미선택 시 슬라이드 배경, 개체 선택 시 해당 개체/셀 배경)">
          <span class="color-preview-bar" id="unifiedBgBar" style="background:#0F172A;"></span>
          <span id="unifiedBgLabel">배경색 ▼</span>
        </button>
      </div>

      <!-- 테두리색 팝오버 (도형 및 표 셀 테두리) -->
      <div class="color-picker-btn-wrapper">
        <button class="color-trigger-btn" id="strokeColorTrigger" onclick="toggleColorPopover('stroke', event)" title="테두리 색상 (도형 및 표 셀)">
          <span class="color-preview-bar" id="strokeColorBar" style="background:#CBD5E1;"></span>
          <span>테두리색 ▼</span>
        </button>
      </div>

      <div class="toolbar-divider-v"></div>

      <!-- 테두리 굵기 숫자 입력 (도형 및 표 셀, PPT 표준 pt 단위) -->
      <span class="prop-inline-label">테두리 굵기:</span>
      <input type="number" class="prop-compact-input" id="propStrokeWidth" min="0" max="72" step="0.25" value="1" oninput="changeStrokeWidth(this.value)" onchange="changeStrokeWidth(this.value)" title="테두리 굵기 (pt, PPT 표준 단위)">
      <span class="prop-unit-label">pt</span>

      <div class="toolbar-divider-v"></div>

      <!-- 투명도 숫자 입력 -->
      <span class="prop-inline-label">투명도:</span>
      <input type="number" class="prop-compact-input" id="propOpacity" min="0" max="100" value="100" oninput="changeOpacity(this.value)" onchange="changeOpacity(this.value)" title="불투명도 (0~100%)">
      <span class="prop-unit-label">%</span>

      <div class="toolbar-divider-v"></div>

      <!-- 통합 전체 선택 버튼 (표 셀 선택 시: 표 전체 셀 선택 / 그 외: 슬라이드 내 모든 개체 선택) -->
      <button class="tool-btn" id="btnSelectAll" onclick="handleSelectAll()" title="전체 선택 (표 선택 시: 표 전체 셀 선택 / 그 외: 슬라이드 내 모든 개체 선택)" style="padding: 3px 8px; font-weight: 600;">🔲 전체 선택</button>

      <!-- 슬라이드 중앙선(안내선) 토글 체크박스 -->
      <label class="guideline-toggle-label" title="슬라이드 가로와 세로 중앙 안내선(눈금선) 표시/숨김">
        <input type="checkbox" id="chkGuideline" onchange="toggleGuideline(this.checked)">
        <span>안내선</span>
      </label>
    </div>
  </header>

  <div class="workspace">
    <aside class="left-nav" id="leftNav">
      <div class="nav-header">
        <span>슬라이드 개요</span>
        <button class="tool-btn" onclick="addNewSlide()" style="padding: 2px 8px; font-weight: bold;">+</button>
      </div>
      <div class="slide-list" id="slideList"></div>
    </aside>

    <div class="nav-resizer" id="navResizer" title="드래그하여 개요 창 너비 조절"></div>

    <main class="canvas-container-outer" id="canvasOuter">
      <div class="canvas-paper-wrapper">
        <div class="canvas-paper">
          <canvas id="slideCanvas"></canvas>
          <textarea id="tableCellEditor" class="table-cell-editor" placeholder="셀 내용 입력"></textarea>
        </div>
      </div>
    </main>

  </div>

  <!-- 도형 선택 드롭다운 팝오버 -->
  <div class="dropdown-menu-popover" id="shapePopover">
    <div class="popover-grid-2">
      <button class="popover-grid-btn" onclick="insertShape('rect'); hideAllPopovers();">⬛ 사각형</button>
      <button class="popover-grid-btn" onclick="insertShape('roundedRect'); hideAllPopovers();">▢ 둥근 사각</button>
      <button class="popover-grid-btn" onclick="insertShape('circle'); hideAllPopovers();">⭕ 원형</button>
      <button class="popover-grid-btn" onclick="insertShape('triangle'); hideAllPopovers();">🔺 삼각형</button>
      <button class="popover-grid-btn" onclick="insertShape('arrow'); hideAllPopovers();">➡️ 화살표</button>
      <button class="popover-grid-btn" onclick="insertShape('line'); hideAllPopovers();">➖ 직선</button>
      <button class="popover-grid-btn" onclick="insertShape('star'); hideAllPopovers();">⭐ 별</button>
      <button class="popover-grid-btn" onclick="insertShape('callout'); hideAllPopovers();">💬 말풍선</button>
    </div>
  </div>

  <!-- 표 삽입 드롭다운 팝오버 -->
  <div class="dropdown-menu-popover" id="tablePopover" style="min-width: 210px;">
    <div style="font-size: 11px; font-weight: 700; color: #94A3B8; margin-bottom: 6px;">빠른 크기 선택</div>
    <div class="popover-grid-2">
      <button class="popover-grid-btn" onclick="insertTable(2, 2); hideAllPopovers();">2 × 2 표</button>
      <button class="popover-grid-btn" onclick="insertTable(3, 3); hideAllPopovers();">3 × 3 표</button>
      <button class="popover-grid-btn" onclick="insertTable(4, 3); hideAllPopovers();">4행 3열</button>
      <button class="popover-grid-btn" onclick="insertTable(5, 4); hideAllPopovers();">5행 4열</button>
    </div>
    <div class="table-custom-row">
      <span>행: <input type="number" id="tblRowsInput" min="1" max="10" value="3"></span>
      <span>열: <input type="number" id="tblColsInput" min="1" max="8" value="3"></span>
      <button class="tool-btn" style="padding: 3px 8px; font-weight: 600;" onclick="insertCustomTable(); hideAllPopovers();">삽입</button>
    </div>
  </div>

  <!-- 미디어 삽입 드롭다운 팝오버 -->
  <div class="dropdown-menu-popover" id="mediaPopover" style="min-width: 230px;">
    <div style="display: flex; flex-direction: column; gap: 6px;">
      <label class="popover-grid-btn" style="cursor: pointer;" title="내 컴퓨터의 이미지 파일 (.png, .jpg 등) 삽입">
        🖼️ 이미지 파일 삽입
        <input type="file" accept="image/*" style="display: none;" onchange="insertImageFile(this); hideAllPopovers();">
      </label>
      <label class="popover-grid-btn" style="cursor: pointer;" title="내 컴퓨터에 저장된 실제 동영상 파일 (.mp4 등) 삽입">
        🎬 내 PC 동영상 파일 삽입 (.mp4)
        <input type="file" accept="video/*" style="display: none;" onchange="insertVideoFile(this); hideAllPopovers();">
      </label>
    </div>
  </div>

  <div class="color-popover" id="colorPopover">
    <div class="popover-row">
      <span class="popover-label">직접 선택</span>
      <div style="display: flex; gap: 6px; align-items: center;">
        <button class="eyedropper-btn" onclick="triggerEyeDropper()">🧪 스포이드</button>
        <input type="color" id="popoverColorInput" onchange="applyColorChoice(this.value)" style="width:26px; height:24px; cursor:pointer;">
      </div>
    </div>
    
    <div>
      <span class="popover-label">기본 색상</span>
      <div class="color-swatches-grid" style="margin-top: 6px;">
        <div class="color-swatch-chip transparent-chip" onclick="applyColorChoice('transparent')" title="투명 (배경 없음)"></div>
        <div class="color-swatch-chip" style="background:#FFFFFF;" onclick="applyColorChoice('#FFFFFF')" title="화이트"></div>
        <div class="color-swatch-chip" style="background:#000000;" onclick="applyColorChoice('#000000')" title="블랙"></div>
        <div class="color-swatch-chip" style="background:#EF4444;" onclick="applyColorChoice('#EF4444')" title="레드"></div>
        <div class="color-swatch-chip" style="background:#F97316;" onclick="applyColorChoice('#F97316')" title="오렌지"></div>
        <div class="color-swatch-chip" style="background:#FACC15;" onclick="applyColorChoice('#FACC15')" title="옐로우"></div>
        <div class="color-swatch-chip" style="background:#22C55E;" onclick="applyColorChoice('#22C55E')" title="그린"></div>
        <div class="color-swatch-chip" style="background:#3B82F6;" onclick="applyColorChoice('#3B82F6')" title="블루"></div>
        <div class="color-swatch-chip" style="background:#6366F1;" onclick="applyColorChoice('#6366F1')" title="인디고"></div>
        <div class="color-swatch-chip" style="background:#A855F7;" onclick="applyColorChoice('#A855F7')" title="퍼플"></div>
      </div>
    </div>

    <div>
      <span class="popover-label">최근 사용 색상</span>
      <div class="recent-colors-row" id="recentColorsContainer" style="margin-top: 6px;"></div>
    </div>
  </div>

  <!-- 우클릭 컨텍스트 메뉴 -->
  <div class="context-menu" id="contextMenu">
    <!-- 1. 슬라이드 빈 배경 우클릭 시 표시되는 슬라이드 레벨 메뉴 -->
    <div id="ctxSlideGroup" style="display: none;">
      <div class="context-menu-item" onclick="ctxChangeSlideBg(event)" title="슬라이드 배경색 변경">
        <span>🎨 슬라이드 배경색 변경</span>
      </div>
      <div class="context-divider"></div>
      <div class="context-menu-item" onclick="ctxAddSlide()" title="새 슬라이드 추가">
        <span>➕ 새 슬라이드 추가</span>
      </div>
      <div class="context-menu-item" onclick="ctxDuplicateSlide()" title="현재 슬라이드 복제">
        <span>📋 슬라이드 복제</span>
      </div>
      <div class="context-menu-item" onclick="ctxPaste()" title="클립보드 개체 붙여넣기 (Ctrl+V)">
        <span>📥 붙여넣기</span>
      </div>
      <div class="context-divider"></div>
      <div class="context-menu-item" onclick="ctxToggleGuideline()" title="중앙 안내선(눈금선) 표시/숨김">
        <span>📏 중앙 안내선 토글</span>
      </div>
      <div class="context-divider"></div>
      <div class="context-menu-item danger center-text" onclick="ctxDeleteSlide()" style="color: #F87171;" title="현재 슬라이드 삭제">
        <span>🗑️ 슬라이드 삭제</span>
      </div>
    </div>

    <!-- 2. 개체 선택 시 표시되는 개체 레벨 메뉴 -->
    <div id="ctxObjectGroup">
      <!-- 표 셀 선택 시 복사/붙여넣기 위에 나타나는 셀병합 / 셀분리 병렬 버튼 -->
      <div id="ctxTableActionGroup" style="display: none;">
        <div class="context-menu-row-2">
          <div class="context-menu-item" id="ctxMergeCellsBtn" onclick="ctxMergeCells()" title="선택한 인접 직사각형 셀 병합">
            <span>⊞ 셀 병합</span>
          </div>
          <div class="context-menu-item" id="ctxSplitCellsBtn" onclick="ctxSplitCells()" title="선택한 병합된 셀 분리">
            <span>⊟ 셀 분리</span>
          </div>
        </div>
        <div class="context-divider"></div>
      </div>

      <!-- 표 셀 선택 시 복사/붙여넣기 위에 나타나는 표 설정 서브메뉴 (호버/클릭 시 옆에 플라이아웃) -->
      <div class="context-submenu-wrapper" id="ctxTableSettingsWrapper" style="display: none;" onclick="event.stopPropagation()">
        <div class="context-menu-item has-submenu" id="ctxTableSettingsTrigger" onclick="toggleCtxTableFlyout(event)">
          <span>⊞ 표 설정</span>
          <span class="submenu-arrow">▶</span>
        </div>
        <!-- 표 설정 서브 플라이아웃 패널 -->
        <div class="context-flyout-panel" id="ctxTableFlyout" onclick="event.stopPropagation()">
          <div class="flyout-header">
            <span>표 & 셀 편집</span>
          </div>
          <div class="flyout-cell-info" id="selectedCellLabel">선택: <span id="selectedCellCoord" style="color: #38BDF8; font-weight: 700;">1행 1열</span></div>
          
          <div class="flyout-row">
            <span class="prop-inline-label">셀 내용:</span>
            <input type="text" class="table-inline-input" id="tableCellInput" placeholder="셀 내용 입력" oninput="updateSelectedCellText(this.value)" style="width: 130px;">
          </div>

          <div class="flyout-divider"></div>

          <div style="font-size: 11px; color: #94A3B8; margin-bottom: 4px;">셀 병합 / 분리</div>
          <div class="btn-group-2x2">
            <button class="tool-btn" id="flyoutMergeBtn" onclick="ctxMergeCells()">⊞ 셀 병합</button>
            <button class="tool-btn" id="flyoutSplitBtn" onclick="ctxSplitCells()">⊟ 셀 분리</button>
          </div>

          <div class="flyout-divider"></div>

          <div style="font-size: 11px; color: #94A3B8; margin-bottom: 6px;">단일 셀 분할 (행 / 열)</div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #E2E8F0; cursor: pointer;">
                <input type="checkbox" id="flyoutSplitRowCheck" checked style="accent-color: #38BDF8; cursor: pointer;">
                <span>행(세로)</span>
              </label>
              <div style="display: flex; align-items: center; gap: 4px;">
                <input type="number" id="flyoutSplitRowCount" class="no-spinner" data-no-stepper="true" min="2" max="10" value="2" style="width: 44px; text-align: center; height: 24px; background: #0F172A; border: 1px solid #334155; border-radius: 4px; color: #FFF; font-weight: 700; font-size: 12px;" title="분할할 행 개수 (화살표 없는 숫자 직접 입력)">
                <span style="font-size: 11px; color: #94A3B8;">행</span>
              </div>
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between;">
              <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #E2E8F0; cursor: pointer;">
                <input type="checkbox" id="flyoutSplitColCheck" checked style="accent-color: #38BDF8; cursor: pointer;">
                <span>열(가로)</span>
              </label>
              <div style="display: flex; align-items: center; gap: 4px;">
                <input type="number" id="flyoutSplitColCount" class="no-spinner" data-no-stepper="true" min="2" max="10" value="2" style="width: 44px; text-align: center; height: 24px; background: #0F172A; border: 1px solid #334155; border-radius: 4px; color: #FFF; font-weight: 700; font-size: 12px;" title="분할할 열 개수 (화살표 없는 숫자 직접 입력)">
                <span style="font-size: 11px; color: #94A3B8;">열</span>
              </div>
            </div>

            <button class="tool-btn primary" onclick="executeCellSplitFromUI()" style="width: 100%; height: 26px; font-size: 11px; margin-top: 2px;">분할 실행</button>
          </div>

          <div class="flyout-divider"></div>

          <div style="font-size: 11px; color: #94A3B8; margin-bottom: 4px;">행 / 열 관리</div>
          <div class="inline-radio-group">
            <label><input type="radio" name="tblTargetType" value="row" checked onchange="updateTableDpadUI()"> 행(Row)</label>
            <label><input type="radio" name="tblTargetType" value="col" onchange="updateTableDpadUI()"> 열(Col)</label>
          </div>
          <div class="inline-radio-group" style="margin-top: 4px;">
            <label><input type="radio" name="tblActionType" value="insert" checked onchange="updateTableDpadUI()"> 삽입</label>
            <label><input type="radio" name="tblActionType" value="delete" onchange="updateTableDpadUI()"> 삭제</label>
          </div>

          <div class="btn-group-2x2" style="margin-top: 8px;">
            <button class="tool-btn" id="tblBtnUp" onclick="onTableAction('up')">⬆️ 위</button>
            <button class="tool-btn" id="tblBtnDown" onclick="onTableAction('down')">⬇️ 아래</button>
            <button class="tool-btn" id="tblBtnLeft" onclick="onTableAction('left')">⬅️ 왼쪽</button>
            <button class="tool-btn" id="tblBtnRight" onclick="onTableAction('right')">➡️ 오른쪽</button>
          </div>
        </div>
        <div class="context-divider"></div>
      </div>

      <div class="context-menu-row-2">
        <div class="context-menu-item" onclick="ctxCopy()" title="복사 (Ctrl+C)"><span>복사</span></div>
        <div class="context-menu-item" onclick="ctxPaste()" title="붙여넣기 (Ctrl+V)"><span>붙여넣기</span></div>
      </div>
      <div class="context-divider"></div>
      <div class="context-menu-item center-text" onclick="ctxCut()" title="잘라내기 (Ctrl+X)"><span>잘라내기</span></div>
      <div class="context-divider"></div>
      <div class="context-menu-row-2">
        <div class="context-menu-item" onclick="ctxGroup()" title="그룹화 (Ctrl+G)"><span>그룹화</span></div>
        <div class="context-menu-item" onclick="ctxUngroup()" title="그룹 해제 (Ctrl+Shift+G)"><span>그룹 해제</span></div>
      </div>
      <div class="context-divider"></div>
      <!-- 위로/맨위로, 아래로/맨아래로 + 가운데 세로 구분선 -->
      <div class="context-menu-paired-grid">
        <div class="context-menu-item" onclick="ctxBringForward()" title="한 단계 위로"><span>위로</span></div>
        <div class="paired-v-divider"></div>
        <div class="context-menu-item" onclick="ctxBringToFront()" title="맨 위로"><span>맨 위로</span></div>
        <div class="context-menu-item" onclick="ctxSendBackward()" title="한 단계 아래로"><span>아래로</span></div>
        <div class="paired-v-divider"></div>
        <div class="context-menu-item" onclick="ctxSendToBack()" title="맨 아래로"><span>맨 아래로</span></div>
      </div>
      <div class="context-divider"></div>
      <div class="context-menu-item danger center-text" onclick="ctxDelete()" style="color: #F87171;" title="삭제 (Del)"><span>삭제</span></div>
    </div>
  </div>

  <div class="toast-msg" id="toast">알림</div>

  <!-- 히스토리(버전 기록 및 백업 복원) 모달 -->
  <div class="history-modal-overlay" id="historyModalOverlay" onclick="closeHistoryModal(event)">
    <div class="history-modal-card" onclick="event.stopPropagation()">
      <div class="history-modal-header">
        <div class="history-modal-title">
          <span>📜 버전 기록 (히스토리)</span>
        </div>
        <button class="history-close-btn" onclick="closeHistoryModal()" title="닫기">✕</button>
      </div>
      <div class="history-modal-desc">
        저장 시점마다 백업된 버전 목록입니다. 원하는 버전을 클릭해 언제든 복원할 수 있습니다. (최근 30개 자동 보관, 백업 파일은 .slide-src/backups/ 에 저장됩니다)
      </div>
      <div class="history-modal-actions-bar">
        <button class="history-new-backup-btn" onclick="createManualBackup()">➕ 현재 상태 즉시 백업</button>
        <button class="history-clear-btn" onclick="clearOldBackups()">🧹 최근 5개 외 오래된 백업 정리</button>
      </div>
      <div class="history-list-container" id="historyListContainer">
        <!-- 자바스크립트로 동적 렌더링 -->
      </div>
    </div>
  </div>

  <!-- 단일 셀 분할 모달 팝업 -->
  <div class="split-cell-modal-overlay" id="splitCellModalOverlay" onclick="closeSplitCellModal(event)">
    <div class="split-cell-card" onclick="event.stopPropagation()">
      <div class="split-cell-header">
        <div class="split-cell-title">
          <span>⊟ 셀 분할 (행 / 열 분리)</span>
        </div>
        <button class="history-close-btn" onclick="closeSplitCellModal()" title="닫기">✕</button>
      </div>
      <div class="split-cell-body">
        <p>선택한 하나의 셀을 분할할 행과 열의 개수를 지정하세요.</p>
        
        <div class="split-checkbox-list">
          <div class="split-checkbox-row">
            <label class="split-check-label">
              <input type="checkbox" id="modalSplitRowCheck" checked>
              <span>행(세로) 분할</span>
            </label>
            <div class="split-input-wrap">
              <input type="number" id="modalSplitRowCount" class="split-count-input no-spinner" data-no-stepper="true" min="2" max="10" value="2" onkeydown="if(event.key==='Enter') confirmSplitCellModal()">
              <span class="split-unit">행</span>
            </div>
          </div>

          <div class="split-checkbox-row">
            <label class="split-check-label">
              <input type="checkbox" id="modalSplitColCheck" checked>
              <span>열(가로) 분할</span>
            </label>
            <div class="split-input-wrap">
              <input type="number" id="modalSplitColCount" class="split-count-input no-spinner" data-no-stepper="true" min="2" max="10" value="2" onkeydown="if(event.key==='Enter') confirmSplitCellModal()">
              <span class="split-unit">열</span>
            </div>
          </div>
        </div>
      </div>
      <div class="split-cell-actions">
        <button class="split-cell-btn cancel" onclick="closeSplitCellModal()">취소</button>
        <button class="split-cell-btn confirm" onclick="confirmSplitCellModal()">분할 실행</button>
      </div>
    </div>
  </div>

  <script id="initialDeckData" type="application/json">${safeJsonString}</script>
  <script src="${jsUri}"></script>
  <script>
    (function() {
      // HTML에 포함된 초기 데이터를 동기 로드한다. (호스트 → 웹뷰 메시지는 editor.js가 직접 처리한다)
      try {
        const el = document.getElementById('initialDeckData');
        if (el && el.textContent && el.textContent.trim()) {
          const initialData = JSON.parse(el.textContent);
          if (window.loadDeckData && initialData && initialData.slides) {
            window.loadDeckData(initialData, true);
          }
        }
      } catch (e) {
        console.warn('초기 인라인 데이터 파싱 실패:', e);
      }
    })();
  </script>
</body>
</html>`;
    }
}
exports.SlideStudioEditorProvider = SlideStudioEditorProvider;
SlideStudioEditorProvider.viewType = 'slideStudio.editor';
//# sourceMappingURL=slideEditorProvider.js.map