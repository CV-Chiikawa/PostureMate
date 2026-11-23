import interviewImage from "../assets/modes/mock-interview.png";
import neckImage from "../assets/modes/neck-posture.png";
import presentationImage from "../assets/modes/presentation.png";

const modeImages = {
  interview: interviewImage,
  neck: neckImage,
  presentation: presentationImage,
};

function ModeArtwork({ modeId, compact = false }) {
  return (
    <div className={`mode-artwork artwork-${modeId} ${compact ? "compact" : ""}`} aria-hidden="true">
      <img src={modeImages[modeId]} alt="" draggable="false" />
    </div>
  );
}

export default ModeArtwork;
