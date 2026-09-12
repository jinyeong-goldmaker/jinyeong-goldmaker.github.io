# 기호논리학 실습도구 (Symbolic Logic Practice Tools)

문장논리(propositional logic)와 술어논리(predicate logic)를 함께 연습할 수 있는 무료 웹 도구 모음입니다.
[논리학당](https://sites.google.com/view/school-of-logic/)의 진리표·적형식 확인 도구와
[기호논리학 실습실](https://zolaist.org/logic/)의 자연연역 증명 검증기에서 영감을 받아,
두 도구의 장점을 한 곳에 모으고 진리나무(semantic tableau) 검사를 더했습니다.

의존성이 전혀 없는 순수 HTML/CSS/JavaScript(ES 모듈)로만 만들어져 있어 별도의 빌드 과정 없이
GitHub Pages 등 정적 호스팅에 바로 올릴 수 있습니다.

## 기능

- **진리표 생성기** (`truth-table.html`) — 문장논리 문장의 진리표 생성, 항진/모순/우연 판정, 전제·결론을 이용한 논증 타당성 검사.
- **적형식·주연결사 확인** (`wff-checker.html`) — 문장논리·술어논리 문장이 적형식(WFF)인지 검사하고 주연결사와 구문 트리를 표시.
- **자연연역 증명기** (`natural-deduction.html`) — 전제/결론을 입력하고 한 줄씩 규칙을 적용해 Fitch 스타일 증명을 작성하면 각 줄을 실시간으로 검증. 가정을 이용한 하위증명(→I, ¬I, ∨E, ∃E 등)과 술어논리 규칙(∀E, ∀I, ∃I, ∃E, =I, =E), 자주 쓰는 파생 규칙(MT, HS, DS, 드모르간)을 지원.
- **진리나무** (`truth-tree.html`) — 전제·결론(또는 문장 하나)에 대해 semantic tableau를 자동으로 전개하여 타당성/충족가능성을 판정하고, 무효인 경우 반례(모형)를 제시. 술어논리 진리나무는 결정불가능하므로 전개 한도에 도달하면 "확실치 않음"으로 표시.
- **연습문제** (`exercises.html`) — 위 도구들로 바로 풀어볼 수 있는 예제 모음 (URL 쿼리로 입력값 자동 채움).

## 표기법

화면의 기호 버튼을 누르거나 아래처럼 직접 입력할 수 있습니다 (자동으로 정규화됩니다):

| 기호 | 입력 예시 |
|---|---|
| ¬ | `~`, `!` |
| ∧ | `&`, `^` |
| ∨ | `\|` (※ `v`는 술어논리 항 문자와 겹치므로 자동 변환하지 않습니다) |
| → | `->` |
| ↔ | `<->` |
| ∀x | `forall x`, `(forall x)`, `(x)` |
| ∃x | `exists x`, `(exists x)`, `(?x)` |
| ⊥ | `\bot` |

술어논리에서 소문자는 모두 항(term)이며, 변항/상항을 미리 구분하지 않고 양화사에 묶여 있는지 여부로 자유/구속을 판단합니다.

## 로컬에서 열어보기

빌드 과정이 필요 없습니다. 저장소를 내려받은 뒤 아무 정적 파일 서버로 열면 됩니다:

```bash
python3 -m http.server 8080
# http://localhost:8080/index.html 접속
```

(ES 모듈을 사용하므로 `file://`로 직접 열면 브라우저가 모듈 로드를 막을 수 있어, 반드시 로컬 서버를 통해 열어야 합니다.)

## GitHub Pages 배포

1. 이 폴더를 저장소(또는 기존 GitHub Pages 저장소의 하위 폴더)에 추가합니다.
2. 저장소 Settings → Pages에서 소스를 해당 브랜치/폴더로 지정합니다.
3. 몇 분 후 `https://<사용자명>.github.io/<저장소명>/` (하위 폴더로 추가했다면 그 경로)에서 접속할 수 있습니다.

## 테스트

핵심 로직(파서, 진리표, 진리나무, 자연연역 검증기)에 대한 단위 테스트가 `tests/`에 있습니다:

```bash
node tests/test-parser.mjs
node tests/test-truthtable.mjs
node tests/test-tree.mjs
node tests/test-nd.mjs
```

## 프로젝트 구조

```
index.html                 홈
truth-table.html           진리표 생성기
wff-checker.html           적형식·주연결사 확인
natural-deduction.html     자연연역 증명기
truth-tree.html            진리나무
exercises.html             연습문제
css/style.css              공통 스타일
js/lib/                    핵심 로직 (파서, 진리표, 진리나무, 자연연역 검증기) — UI에 의존하지 않는 순수 모듈
js/pages/                  각 HTML 페이지를 담당하는 스크립트
js/lib/ui.js               작은 DOM 헬퍼
tests/                     Node 기반 단위 테스트
```

## 한계 / 알려진 제약

- 자연연역의 ∀-도입(∀I)/∃-제거(∃E)는 전제·가정에 나타나는 자유 문자와의 충돌만 검사하는 단순화된 "고정변항 조건"을 사용합니다.
- =E(동일성 제거)는 원자문장 단위의 라이프니츠 치환만 지원하며, 임의의 복합식 안으로 자동 대입하지는 않습니다.
- 술어논리 진리나무는 이론적으로 결정불가능한 절차이므로, 전개 한도 내에 끝나지 않으면 "확실치 않음"을 반환합니다 (버그가 아니라 의도된 동작입니다).

## 라이선스

MIT License — 자유롭게 사용, 수정, 배포할 수 있습니다.
