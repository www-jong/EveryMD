// ─── EveryMD 내장 Line Diff & 3-Way Merge 유틸리티 ──────────────────────────

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface ThreeWayMergeResult {
  hasConflict: boolean;
  mergedContent: string;
}

/**
 * 두 텍스트 간의 줄(Line) 단위 LCS(최장 공통 부분 수열) Diff 계산
 * Git diff와 동일한 구조로 추가(+), 삭제(-), 유지(unchanged) 라인을 생성합니다.
 */
export function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split(/\r?\n/);
  const newLines = newText.split(/\r?\n/);

  const n = oldLines.length;
  const m = newLines.length;

  // DP 테이블 생성 (메모리 보호를 위해 최대 2000줄 제한)
  if (n > 2000 || m > 2000) {
    // 초대형 파일의 경우 빠른 라인 비교 폴백
    return fallbackFastDiff(oldLines, newLines);
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (oldLines[i] === newLines[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  let i = n;
  let j = m;
  let oldLineNum = n;
  let newLineNum = m;

  const stack: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      stack.push({
        type: 'unchanged',
        content: oldLines[i - 1],
        oldLineNumber: oldLineNum,
        newLineNumber: newLineNum,
      });
      i--;
      j--;
      oldLineNum--;
      newLineNum--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({
        type: 'added',
        content: newLines[j - 1],
        newLineNumber: newLineNum,
      });
      j--;
      newLineNum--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      stack.push({
        type: 'removed',
        content: oldLines[i - 1],
        oldLineNumber: oldLineNum,
      });
      i--;
      oldLineNum--;
    }
  }

  return stack.reverse();
}

function fallbackFastDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const result: DiffLine[] = [];
  const max = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < max; i++) {
    const o = oldLines[i];
    const n = newLines[i];
    if (o === n) {
      if (o !== undefined) {
        result.push({ type: 'unchanged', content: o, oldLineNumber: i + 1, newLineNumber: i + 1 });
      }
    } else {
      if (o !== undefined) {
        result.push({ type: 'removed', content: o, oldLineNumber: i + 1 });
      }
      if (n !== undefined) {
        result.push({ type: 'added', content: n, newLineNumber: i + 1 });
      }
    }
  }
  return result;
}

/**
 * Git 표준 3-Way Auto-Merge 알고리즘
 * - base: 마지막으로 동기화된 원본 텍스트
 * - local: EveryMD에서 사용자가 편집 중인 텍스트
 * - remote: 외부 디스크에서 수정된 텍스트
 *
 * 겹치지 않는(non-conflicting) 서로 다른 줄의 수정은 자동으로 병합합니다.
 * 동일한 줄을 서로 다르게 수정한 경우에만 hasConflict: true를 반환합니다.
 */
export function threeWayMerge(
  base: string,
  local: string,
  remote: string
): ThreeWayMergeResult {
  if (local === remote) {
    return { hasConflict: false, mergedContent: local };
  }
  if (base === local) {
    // 로컬 수정 없음 -> 외부 수정본 그대로 적용
    return { hasConflict: false, mergedContent: remote };
  }
  if (base === remote) {
    // 외부 수정 없음 -> 로컬 편집본 그대로 유지
    return { hasConflict: false, mergedContent: local };
  }

  // base와 local의 diff
  const diffLocal = computeLineDiff(base, local);
  // base와 remote의 diff
  const diffRemote = computeLineDiff(base, remote);

  // base 라인별 변경 추적
  // 1-indexed 라인 번호 기준
  const localAddedAfter: Record<number, string[]> = {};
  const localRemovedLines = new Set<number>();
  const remoteAddedAfter: Record<number, string[]> = {};
  const remoteRemovedLines = new Set<number>();

  let curBaseLine = 0;
  for (const d of diffLocal) {
    if (d.type === 'unchanged') {
      curBaseLine = d.oldLineNumber || curBaseLine + 1;
    } else if (d.type === 'removed') {
      if (d.oldLineNumber) localRemovedLines.add(d.oldLineNumber);
    } else if (d.type === 'added') {
      if (!localAddedAfter[curBaseLine]) localAddedAfter[curBaseLine] = [];
      localAddedAfter[curBaseLine].push(d.content);
    }
  }

  curBaseLine = 0;
  for (const d of diffRemote) {
    if (d.type === 'unchanged') {
      curBaseLine = d.oldLineNumber || curBaseLine + 1;
    } else if (d.type === 'removed') {
      if (d.oldLineNumber) remoteRemovedLines.add(d.oldLineNumber);
    } else if (d.type === 'added') {
      if (!remoteAddedAfter[curBaseLine]) remoteAddedAfter[curBaseLine] = [];
      remoteAddedAfter[curBaseLine].push(d.content);
    }
  }

  // 충돌 검사: 같은 base 라인을 양쪽에서 모두 삭제/변경했거나, 같은 위치에 서로 다른 내용을 추가한 경우
  const baseLines = base.split(/\r?\n/);
  for (let i = 1; i <= baseLines.length; i++) {
    const localDel = localRemovedLines.has(i);
    const remoteDel = remoteRemovedLines.has(i);
    if (localDel && remoteDel) {
      // 둘 다 같은 줄 삭제는 충돌 아님 (동일 액션)
    } else if ((localDel && !remoteDel && remoteAddedAfter[i]) || (remoteDel && !localDel && localAddedAfter[i])) {
      return { hasConflict: true, mergedContent: local };
    }

    const localAdds = localAddedAfter[i];
    const remoteAdds = remoteAddedAfter[i];
    if (localAdds && remoteAdds) {
      if (localAdds.join('\n') !== remoteAdds.join('\n')) {
        // 같은 위치에 서로 다른 내용 추가 -> 충돌
        return { hasConflict: true, mergedContent: local };
      }
    }
  }

  // 0번째 위치(파일 맨 앞) 추가 검사
  if (localAddedAfter[0] && remoteAddedAfter[0]) {
    if (localAddedAfter[0].join('\n') !== remoteAddedAfter[0].join('\n')) {
      return { hasConflict: true, mergedContent: local };
    }
  }

  // 겹치는 충돌이 없으므로 자동 병합 조립 수행!
  const merged: string[] = [];

  // 파일 맨 앞 추가분
  if (localAddedAfter[0]) merged.push(...localAddedAfter[0]);
  else if (remoteAddedAfter[0]) merged.push(...remoteAddedAfter[0]);

  for (let i = 1; i <= baseLines.length; i++) {
    const isDeleted = localRemovedLines.has(i) || remoteRemovedLines.has(i);
    if (!isDeleted) {
      merged.push(baseLines[i - 1]);
    }

    // 해당 라인 뒤에 추가된 내용 결합
    if (localAddedAfter[i]) {
      merged.push(...localAddedAfter[i]);
    } else if (remoteAddedAfter[i]) {
      merged.push(...remoteAddedAfter[i]);
    }
  }

  return {
    hasConflict: false,
    mergedContent: merged.join('\n'),
  };
}
