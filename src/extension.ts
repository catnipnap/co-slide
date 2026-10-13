import * as vscode from 'vscode';
import { SlideStudioEditorProvider } from './slideEditorProvider';

export function activate(context: vscode.ExtensionContext) {
  // 1. 커스텀 슬라이드 에디터 프로바이더 등록 (*.slide.json 연동)
  context.subscriptions.push(SlideStudioEditorProvider.register(context));

  // 2. 새 프레젠테이션 파일 생성 명령어 등록
  context.subscriptions.push(
    vscode.commands.registerCommand('slideStudio.createNewDeck', async () => {
      const defaultDeck = {
        version: "1.0",
        title: "새 프레젠테이션",
        theme: {
          primary: "#2563EB",
          secondary: "#64748B",
          background: "#F8FAFC"
        },
        slides: [
          {
            id: "slide-1",
            title: "제목 슬라이드",
            background: "#0F172A",
            elements: [
              {
                id: "el-1",
                type: "text",
                text: "새 프레젠테이션 제목",
                left: 200,
                top: 400,
                width: 1520,
                fontSize: 60,
                fontWeight: "bold",
                fill: "#FFFFFF",
                align: "center",
                fontFamily: "Pretendard"
              }
            ]
          }
        ]
      };

      const newUri = vscode.Uri.parse('untitled:new-presentation.slide.json');
      const doc = await vscode.workspace.openTextDocument(newUri);
      const edit = new vscode.WorkspaceEdit();
      edit.insert(newUri, new vscode.Position(0, 0), JSON.stringify(defaultDeck, null, 2));
      await vscode.workspace.applyEdit(edit);
      await vscode.window.showTextDocument(doc);
    })
  );

  console.log('Antigravity Slide Studio 익스텐션이 활성화되었습니다.');
}

export function deactivate() {}
