// Browser regression tests use a virtual capture device and the real analysis server.
const assert = require("node:assert/strict");
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || "playwright-core");

(async () => {
  const browser = await chromium.launch({channel:"chrome", headless:true,
    args:["--use-fake-device-for-media-stream","--use-fake-ui-for-media-stream",
      ...(process.env.POSE_SAMPLE ? ["--use-file-for-fake-video-capture="+process.env.POSE_SAMPLE] : [])]});
  try {
    const ctx = await browser.newContext({permissions:["camera"]});
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", e=>errors.push(e.message));
    await page.goto(process.env.POSTUREMATE_WEB || "http://127.0.0.1:5173");
    const button = name => page.getByRole("button",{name,exact:typeof name==="string"});
    await button("사용 안내 닫기").click();
    for (const mode of (process.env.POSE_SAMPLE ? ["모의면접"] : ["발표","거북목 방지","모의면접"])) {
      await button("모드 선택").click();
      await button(mode+" 모드로 바로 시작").click();
      assert.match(await page.locator(".analysis-heading h1").innerText(),new RegExp(mode));
      assert.equal(await page.locator(".preview video").count(), 1, "Every mode opens the webcam preview directly");
      await page.waitForFunction(() => document.querySelector("video")?.videoWidth > 0);
      assert.doesNotMatch(await page.locator("main").innerText(), /데모|시연 도구/);
      const response = page.waitForResponse(r=>r.url().endsWith("/process-frame") && r.request().method()==="POST");
      await button("분석 시작").click();
      const payload = await (await response).json();
      assert.equal(payload.analysis_source,"mediapipe");
      assert.equal(payload.context.mode, {"발표":"presentation","거북목 방지":"neck","모의면접":"interview"}[mode]);
      if (process.env.POSE_SAMPLE) {
        await page.getByRole("heading",{name:"주의가 필요합니다"}).waitFor();
        await page.getByRole("heading",{name:"자세 교정이 필요합니다"}).waitFor();
        await page.locator(".coaching-panel blockquote").filter({hasText:/무릎/}).waitFor({timeout:12000});
        await button("분석 종료").click();
        const stats = await page.locator(".result-overview").innerText();
        assert.match(stats,/주의\s+1회/);
        assert.match(stats,/경고\s+1회/);
        assert.ok(Number(stats.match(/누적 이상 시간\s+([\d.]+)초/)?.[1]) >= 5);
        assert.match(await page.locator(".result-statistics").innerText(),/손·무릎 배치\s+1회/);
        console.log("Person JPEG -> MediaPipe -> caution, warning, fallback, single 5s episode PASS");
        continue;
      }
      assert.equal(payload.measurement_status,"unavailable");
      await page.getByRole("heading",{name:"자세 측정 불가"}).waitFor();
      if (mode === "거북목 방지") {
        assert.match(await page.locator(".preview").innerText(), /5초/);
        await page.locator(".coaching-panel blockquote").filter({hasText:/얼굴.*어깨/}).waitFor({timeout:12000});
        assert.doesNotMatch(await page.locator(".coaching-panel blockquote").innerText(), /40~65|\d+초/);
        let reason = "view_inference";
        await page.route("**/process-frame", route => route.fulfill({json:{
          ...payload, measurement_status:"calibrating", measurement_reason:reason
        }}));
        await page.getByRole("heading",{name:"카메라 구도 확인 중"}).waitFor();
        reason = "calibrating";
        await page.getByRole("heading",{name:"기준 자세 보정 중"}).waitFor();
        assert.match(await page.locator(".coaching-panel blockquote").innerText(), /5초/);
        await page.unroute("**/process-frame");
        await page.getByRole("heading",{name:"자세 측정 불가"}).waitFor();
      }
      if (mode !== "거북목 방지") {
        let currentSession = payload.session_id;
        let referenceTimedOut = false;
        await page.route("**/process-frame", route => {
          currentSession = route.request().postData().match(/name="session_id"\r\n\r\n([^\r\n]+)/)[1];
          return route.fulfill({json:{...payload,session_id:currentSession,
            measurement_status:"calibrating",measurement_reason:referenceTimedOut ? "reference_timeout" : "reference_collecting",
            calibration:{status:"collecting",progress:.4,required_seconds:5,minimum_samples:15,
              accepted_samples:4,unstable_feature:referenceTimedOut ? "knee" : null}}});
        });
        await page.getByRole("heading",{name:"기준 자세 보정 중"}).waitFor();
        assert.match(await page.locator(".coaching-panel blockquote").innerText(), /40%/);
        referenceTimedOut = true;
        await page.getByRole("heading",{name:"기준 자세 측정 지연"}).waitFor();
        assert.match(await page.locator(".coaching-panel blockquote").innerText(), /무릎 간격.*4\/15/);
        referenceTimedOut = false;
        const previousSession = currentSession;
        const changedRequest = page.waitForRequest(r => r.url().endsWith("/process-frame") && !r.postData().includes(previousSession));
        await button("기준 자세 다시 측정").click();
        await changedRequest;
        await page.unroute("**/process-frame");
        // Refresh the packet for the newly created session used by later UI scenarios.
        const resumed = await page.waitForResponse(r=>r.url().endsWith("/process-frame") && r.request().method()==="POST");
        Object.assign(payload,await resumed.json());
        await page.getByRole("heading",{name:"자세 측정 불가"}).waitFor();
        console.log(mode, "reference progress and explicit new-session recalibration PASS");
      }
      if (mode === "모의면접") {
        await page.route("**/process-frame", route => route.fulfill({json:{...payload,
          measurement_status:"valid",measurement_reason:null,state:"CANDIDATE",event:null,coaching:null,
          features:{head_tilt:0,shoulder_height_difference:0,torso_lean:0,body_sway:0,landmark_visibility:1,
            left_hand_region:"center",right_hand_region:"center",knee_distance:1.3,knee_reference_distance:.825,
            knee_distance_ratio:1.58,knee_placement_status:"too_wide",hand_placement_status:"correct",placement_issues:["knees_apart"]}}}));
        await page.locator(".placement-live").waitFor();
        const summary = page.locator(".feature-summary > div");
        assert.equal(await summary.filter({has:page.getByText("손 배치",{exact:true})}).locator("strong").innerText(),"양호");
        assert.equal(await summary.filter({has:page.getByText("무릎 간격",{exact:true})}).locator("strong").innerText(),"주의");
        assert.match(await page.locator(".placement-live").innerText(),/중앙 무릎 영역.*중앙 무릎 영역/);
        assert.match(await page.locator(".placement-live").innerText(),/기준보다 벌어짐.*1.58배/);
        await page.unroute("**/process-frame");
        await page.getByRole("heading",{name:"자세 측정 불가"}).waitFor();
        console.log("Independent correct hands and wide knees feedback PASS");
      }
      assert.equal(await page.locator(".preview .pose-overlay").count(),0);
      // Alternate missing joints and usable measurements on the real preview page.
      let routed = 0;
      let stable = false;
      const routePattern = "**/process-frame";
      const values = payload.context.mode === "neck"
        ? { neck_score:0, neck_level:"GOOD", neck_view:"FRONT", landmark_visibility:1 }
        : { head_tilt:0, shoulder_height_difference:0, body_sway:0, landmark_visibility:1 };
      const nextResult = {...payload, measurement_status:"valid", measurement_reason:null,
        state:"NORMAL", features:values, event:null, coaching:null};
      await page.evaluate(() => {
        const node = document.querySelector(".status-panel h2");
        window.seenPostures = new Set([node.textContent]);
        window.postureObserver = new MutationObserver(() => window.seenPostures.add(node.textContent));
        window.postureObserver.observe(node,{childList:true,characterData:true,subtree:true});
      });
      await page.route(routePattern, route => {
        routed++;
        return route.fulfill({json: stable || routed % 2 ? nextResult : payload});
      });
      while (routed < 12) await page.waitForResponse(r => r.url().endsWith("/process-frame"),{timeout:5000});
      assert.deepEqual(await page.evaluate(() => Array.from(window.seenPostures)), ["자세 측정 불가"]);
      stable = true;
      await page.getByRole("heading",{name:"정상 자세"}).waitFor();
      await page.evaluate(() => window.postureObserver.disconnect());
      await page.unroute(routePattern);
      await page.getByRole("heading",{name:"자세 측정 불가"}).waitFor();
      if (mode==="발표") {
        await page.locator("video").evaluate(video => video.srcObject.getVideoTracks()[0].dispatchEvent(new Event("ended")));
        await button("다시 시도").waitFor();
        assert.equal(await page.getByRole("heading", {name:"자세 측정 불가"}).count(), 0, "Discard stale measurements when the track ends");
        await button("다시 시도").click();
        await page.getByRole("heading",{name:"자세 측정 불가"}).waitFor();
        await page.route("**/process-frame", route=>route.abort());
        await page.getByRole("heading",{name:"분석 연결 끊김"}).waitFor();
        await page.unroute("**/process-frame");
        await page.getByRole("heading",{name:"자세 측정 불가"}).waitFor();
      }
      if (mode === "거북목 방지") {
        const panel = page.locator(".coaching-panel");
        const basic = "머리가 기준 자세보다 앞으로 나와 있습니다. 턱을 가볍게 당겨 주세요.";
        const generated = "머리가 기준 자세보다 앞으로 나와 있습니다. 고개를 처음 위치로 돌려 보세요.";
        const normal = "현재 자세가 기준 범위에 있습니다. 그대로 유지해 주세요.";
        const tilted = "고개가 한쪽으로 기울어져 있습니다. 고개를 천천히 바로 세워 주세요.";
        let event = {event_id:"neck-guide", mode:"neck", rubric:null, type:"forward_head_proxy",
          severity:"warning", started_at:0, duration_sec:2, confidence:1, metrics:{neck_score:4}};
        let firstFrame = true;
        let solar = false;
        let state = "NORMAL";
        let hint = basic;
        await page.route(routePattern, route => {
          if (state !== "WARNING") return route.fulfill({json:{...nextResult, state}});
          const coaching = firstFrame || solar
            ? {event_id:event.event_id, source:solar ? "solar" : "fallback", message:solar ? generated : hint} : null;
          const packet = {...nextResult, state, features:{...values, neck_score:4, neck_level:"BAD"},
            event:firstFrame ? event : null, coaching};
          firstFrame = false;
          return route.fulfill({json:packet});
        });
        await panel.getByText(normal, {exact:true}).waitFor();
        state = "WARNING";
        await page.getByRole("heading",{name:"자세 교정이 필요합니다"}).waitFor();
        assert.equal(await panel.locator("blockquote p").innerText(), basic, "Confirmed warning must replace normal coaching immediately");
        const started = await page.evaluate(() => performance.now());
        solar = true;
        await panel.getByText(generated, {exact:true}).waitFor({timeout:12000});
        const readableMs = (await page.evaluate(() => performance.now())) - started;
        assert.ok(readableMs >= 7650, `Fallback replaced after ${Math.round(readableMs)} ms`);
        assert.equal(await panel.locator(".eyebrow").innerText(), "SOLAR 코칭");
        // Only one frame carries the new event. The status remains WARNING.
        solar = false;
        event = {...event, event_id:"tilt-guide", metrics:{neck_score:4, observation:"head_tilt"}};
        hint = tilted;
        firstFrame = true;
        await panel.getByText(tilted, {exact:true}).waitFor({timeout:1800});
        state = "RECOVERED";
        await page.getByRole("heading",{name:"정상 자세로 돌아왔습니다"}).waitFor();
        assert.equal(await panel.locator("blockquote p").innerText(), "자세가 기준 범위로 돌아왔습니다.");
        await page.unroute(routePattern);
        await page.getByRole("heading",{name:"자세 측정 불가"}).waitFor();
        assert.doesNotMatch(await panel.innerText(), /SOLAR 코칭/);
        console.log("Warning, new observation and recovery match the coaching card; same-event Solar reading time PASS");
      }
      await button("일시정지").click();
      await button("계속하기").click();
      await button("분석 종료").click();
      const recoveries = mode === "거북목 방지" ? 1 : 0;
      assert.match(await page.locator(".result-overview").innerText(),new RegExp(`정상 복귀\\s+${recoveries}회`));
      assert.equal(await page.locator("video").evaluate(v=>v.srcObject),null);
      console.log(mode, payload.analysis_source, payload.measurement_status, "PASS");
    }
    assert.deepEqual(errors,[]);
    if (!process.env.POSE_SAMPLE) {
      // Resolve a camera request after leaving the preview. Its late stream must be released.
      await page.evaluate(() => {
        const acquire = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = async options => {
          const stream = await acquire(options);
          window.testTrack = stream.getVideoTracks()[0];
          await new Promise(resolve => { window.releaseCameraRequest = resolve; });
          return stream;
        };
      });
      await button("다시 분석하기").click();
      await page.waitForFunction(()=>Boolean(window.releaseCameraRequest));
      assert.equal(await button("분석 시작").isDisabled(),true);
      await button("모드 선택").click();
      await page.evaluate(()=>window.releaseCameraRequest());
      await page.waitForFunction(()=>window.testTrack.readyState === "ended",null,{timeout:2500});
      assert.equal(await page.locator("video").count(),0);
      console.log("Late camera grant after leaving preview PASS");
      await page.evaluate(() => {
        navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("Denied", "NotAllowedError"); };
      });
      await button("발표 모드로 바로 시작").click();
      await button("다시 시도").waitFor();
      assert.equal(await button("분석 시작").isDisabled(),true);
      assert.doesNotMatch(await page.locator("main").innerText(), /데모|정상 자세/);
      await page.evaluate(() => { delete navigator.mediaDevices.getUserMedia; });
      await button("다시 시도").click();
      await page.waitForFunction(() => document.querySelector("video")?.videoWidth > 0);
      assert.equal(await button("분석 시작").isEnabled(),true);
      console.log("Permission denial and camera retry PASS");
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
