interface Props {
  onClose: () => void;
}

export function HelpModal({ onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal help-modal" onClick={(e) => e.stopPropagation()}>
        <h3>게임 방법</h3>
        <div className="help-modal-body">
          <section>
            <h4>로비</h4>
            <p>방 카드를 눌러 입장하거나, Create Room으로 맵을 고른 새 방을 만듭니다.</p>
          </section>
          <section>
            <h4>설정 (Settings)</h4>
            <p>닉네임과 캐릭터를 고릅니다. 일부 캐릭터는 누적 승리 횟수로 잠금 해제됩니다. 저장 후 방에 들어가면 선택이 적용됩니다.</p>
          </section>
          <section>
            <h4>대기실</h4>
            <p>2명 이상이면 아무나 Start Game으로 시작할 수 있습니다. 혼자 연습하려면 Add Bot을 누르세요.</p>
          </section>
          <section>
            <h4>전투 (턴제)</h4>
            <ul>
              <li><strong>PC:</strong> WASD 또는 방향키로 이동, 화면을 드래그해 물건을 던집니다 (당긴 길이와 방향이 파워·각도).</li>
              <li><strong>모바일:</strong> 왼쪽 조이스틱 이동, 점프 버튼, 오른쪽 원에서 당겨 조준 후 손을 떼면 발사.</li>
              <li>아래 아이콘으로 던질 물건을 고릅니다.</li>
            </ul>
          </section>
          <section>
            <h4>맵 추락</h4>
            <p>
              플랫폼 밖으로 떨어지면 중앙 근처로 복귀합니다. <strong>추락할 때마다 남은 HP의 약 1/3이 줄고</strong>,{' '}
              <strong>같은 매치에서 3번째 추락 시 탈락</strong>합니다.
            </p>
          </section>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
