import test from 'node:test';
import assert from 'node:assert/strict';
import {referenceNotice} from '../src/utils/calibrationGuide.js';

test('기준 측정 지연은 문제 추정 부위와 유효 프레임 수를 안내한다',()=>{
  const r=referenceNotice('reference_timeout',{unstable_feature:'knee',accepted_samples:8,minimum_samples:15},'interview','A');
  assert.equal(r.title,'기준 자세 측정 지연');
  assert.match(r.message,/무릎 간격/);
  assert.match(r.message,/8\/15/);
  assert.match(r.message,/아직 저장하지 않았습니다/);
});

test('일시적인 튐을 사용자 움직임으로 단정하지 않고 진행률을 보여준다',()=>{
  const r=referenceNotice('reference_unstable',{unstable_feature:'forward',accepted_samples:9,progress:.6},'interview','A');
  assert.match(r.message,/상체 전방 추정값/);
  assert.match(r.message,/60%/);
  assert.match(r.message,/9\/15/);
});

test('루브릭과 누락된 선택 메타데이터를 안전하게 처리한다',()=>{
  const r=referenceNotice('reference_collecting',null,'interview','B');
  assert.match(r.message,/무릎을 자연스럽게 벌리고/);
  assert.match(r.message,/0%/);
});
