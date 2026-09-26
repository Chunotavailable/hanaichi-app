// pages/index.js — Trang chủ: chỉ hiện 1 câu quote động lực, đổi mỗi lần mở lại
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme, makeStyles } from "../lib/theme";
import { NAV_ITEMS } from "../lib/nav";

const QUOTES = [
  "Không có con đường nào dẫn đến thành công mà không đi qua sự kiên trì.",
  "Mỗi ngày cố gắng thêm một chút, một năm sau nhìn lại sẽ thấy khác biệt rất nhiều.",
  "Việc khó không phải để làm nản lòng, mà để phân biệt ai thật sự muốn đi tới cùng.",
  "Thành công không đến từ một ngày rực rỡ, mà từ rất nhiều ngày bình thường làm việc chăm chỉ.",
  "Đừng sợ đi chậm, chỉ sợ đứng yên.",
  "Cách tốt nhất để dự đoán tương lai là tự tay tạo ra nó.",
  "Ai cũng có ngày mệt mỏi, quan trọng là vẫn bước tiếp vào ngày hôm sau.",
  "Kỷ luật là cây cầu nối giữa mục tiêu và thành quả.",
  "Làm việc chăm chỉ trong im lặng, để thành quả tự cất tiếng nói thay mình.",
  "Không ai giỏi ngay từ đầu, chỉ có ai chịu luyện tập đủ lâu.",
  "Hôm nay khó khăn, ngày mai khó khăn hơn, nhưng ngày kia sẽ rất tươi đẹp.",
  "Bình tĩnh mà sống, chăm chỉ mà làm, rồi mọi thứ sẽ đến đúng lúc của nó.",
  "Đừng so sánh hành trình của mình với người khác, ai cũng có tốc độ riêng.",
  "Cứ gieo hạt tử tế, đến lúc gặt sẽ không thiệt bao giờ.",
  "Người thành công không phải người chưa từng vấp ngã, mà là người luôn đứng dậy.",
  "Một chút cố gắng mỗi ngày, cộng dồn lại sẽ thành một sự thay đổi lớn.",
  "Việc hôm nay chớ để ngày mai, vì ngày mai còn có việc của ngày mai.",
  "Sự bền bỉ âm thầm luôn đáng giá hơn những lời hứa hẹn ồn ào.",
  "Cứ làm tốt phần việc của mình, kết quả tự khắc sẽ theo sau.",
  "Thay vì lo lắng về những gì chưa làm được, hãy bắt tay vào làm điều có thể làm ngay bây giờ.",
  "Cứ tin vào quá trình, kết quả sẽ không phụ lòng người kiên trì.",
  "Ngày hôm nay bận rộn cũng là ngày hôm nay đang tiến về phía trước.",
  "Không có thành công nào là ngẫu nhiên, tất cả đều bắt đầu từ một quyết định bắt tay vào làm.",
  "Cứ chăm chỉ đi, may mắn rồi sẽ tự tìm đến người chịu cố gắng.",
  "Uy tín là thứ xây cả năm nhưng có thể mất chỉ trong một câu nói dối.",
  "Khách hàng nhớ cách mình đối xử với họ lâu hơn là nhớ giá của món hàng.",
  "Làm ăn lâu dài là làm bằng cái tâm, không phải chỉ bằng lời quảng cáo hay.",
  "Mỗi đơn hàng nhỏ hôm nay là một viên gạch cho thành quả lớn hơn sau này.",
  "Chưa thấy kết quả rõ ràng không có nghĩa là không có gì đang âm thầm thay đổi.",
  "Người kiên nhẫn với công việc nhỏ mới xứng đáng được giao việc lớn.",
  "Cứ làm hết sức trong khả năng của mình, phần còn lại để thời gian trả lời.",
  "Muốn đi nhanh thì đi một mình, muốn đi xa thì phải đi cùng sự tử tế.",
  "Mệt thì nghỉ một chút, nhưng đừng bỏ cuộc giữa chừng.",
  "Không ai đánh giá thấp người luôn giữ đúng lời hứa với khách hàng.",
  "Sự chỉn chu trong từng việc nhỏ là nền móng cho một thương hiệu lớn.",
  "Cứ tử tế với mọi người, rồi sẽ có ngày điều tử tế quay lại với mình.",
  "Áp lực chỉ là dấu hiệu cho thấy mình đang cố gắng vượt lên chính mình.",
  "Đường dài mới biết ngựa hay, việc lâu mới biết lòng người có bền hay không.",
  "Làm việc tử tế không cần ồn ào, chỉ cần đều đặn mỗi ngày.",
  "Ai rồi cũng có lúc chán nản, quan trọng là không để nó kéo dài quá lâu.",
  "Cứ vững tin vào con đường mình chọn, dù đi chậm hơn người khác một chút.",
  "Một lời cảm ơn chân thành có thể giữ chân khách hàng lâu hơn một lời khuyến mãi.",
  "Sai ở đâu sửa ở đó, không ai hoàn hảo ngay từ lần đầu tiên.",
  "Cứ gieo trồng tử tế mỗi ngày, thành quả sẽ đến đúng mùa của nó.",
  "Người chăm chỉ không sợ khởi đầu nhỏ, chỉ sợ không dám bắt đầu.",
  "Bán hàng giỏi là bán được lòng tin trước, rồi mới bán được sản phẩm.",
  "Cứ cố gắng thêm một chút mỗi ngày, đừng so mình với ngày hôm qua của người khác.",
  "Nụ cười và sự chân thành là thứ vốn liếng không bao giờ lỗ.",
  "Khó khăn hôm nay là bài học để mai này mình vững vàng hơn.",
  "Chậm mà chắc vẫn hơn nhanh mà ẩu, nhất là trong chuyện làm ăn lâu dài.",
  "Không có khách hàng nào là nhỏ, chỉ có sự tận tâm là lớn hay không thôi.",
  "Cứ làm tốt vai trò của mình, thời gian sẽ chứng minh cho những nỗ lực đó.",
  "Ngày nào cũng cố thêm một chút, một thời gian sau sẽ thấy mình khác hẳn.",
  "Người biết lắng nghe khách hàng luôn bán được nhiều hơn người chỉ biết nói.",
  "Đừng ngại việc nhỏ, vì mọi việc lớn đều bắt đầu từ những việc rất nhỏ.",
  "Có tâm với nghề thì nghề sẽ không phụ mình.",
  "Cứ bền bỉ như dòng nước chảy, đá cứng đến mấy cũng có ngày mòn.",
  "Mỗi lần vượt qua khó khăn là một lần mình mạnh mẽ hơn trước.",
  "Thành quả ngọt ngào thường đến sau những ngày làm việc âm thầm không ai thấy.",
  "Cứ tập trung làm tốt hôm nay, ngày mai tự khắc sẽ dễ thở hơn.",
  "Kiên trì không phải là không mệt, mà là mệt vẫn cố bước tiếp.",
  "Một khách hàng hài lòng có thể mang đến mười khách hàng mới.",
  "Đừng để một ngày tệ làm hỏng cả một hành trình dài đang cố gắng.",
  "Cứ làm việc như thể không ai nhìn thấy, kết quả sẽ khiến ai cũng phải nhìn thấy.",
  "Người kiên định với mục tiêu ít khi bị lung lay bởi lời chê bai nhất thời.",
  "Chuyện gì cũng có lúc khó, quan trọng là mình chọn cách đối mặt hay né tránh.",
  "Càng làm nhiều càng quen tay, càng quen tay càng làm tốt hơn.",
  "Cứ vui vẻ với công việc mỗi ngày, năng lượng đó khách hàng sẽ cảm nhận được.",
  "Không có nghề nào là dễ, chỉ có người kiên trì mới trụ được lâu với nghề.",
  "Cứ đối xử với khách như người thân, họ sẽ quay lại như một thói quen.",
  "Cẩn thận trong từng chi tiết nhỏ là cách xây dựng niềm tin lớn.",
  "Một ngày làm việc chăm chỉ là một ngày mình tiến gần hơn tới mục tiêu.",
  "Đừng vội nản khi mọi thứ chưa như ý, hãy cho nó thêm thời gian.",
  "Cứ giữ sự tử tế làm gốc, mọi mối quan hệ làm ăn rồi sẽ bền lâu.",
  "Người chịu khó học hỏi từ sai lầm sẽ tiến xa hơn người sợ mắc lỗi.",
  "Thành công là tổng của rất nhiều nỗ lực nhỏ lặp đi lặp lại mỗi ngày.",
  "Cứ làm những gì đúng, dù không phải lúc nào cũng là điều dễ dàng.",
  "Một câu trả lời nhiệt tình có thể giữ được một khách hàng cả năm.",
  "Đừng sợ bắt đầu lại, vì mỗi lần bắt đầu là một cơ hội làm tốt hơn.",
  "Cứ giữ vững tinh thần, rồi khó khăn nào cũng sẽ có cách vượt qua.",
  "Người làm ăn có tâm luôn được khách hàng nhớ đến đầu tiên.",
  "Chăm chỉ hôm nay để không phải hối tiếc vào ngày mai.",
  "Cứ cố gắng đều đặn, đừng đợi có động lực mới bắt đầu làm việc.",
  "Một nụ cười khi bán hàng có giá trị hơn cả ngàn lời quảng cáo.",
  "Đừng để sự trì hoãn cướp mất cơ hội đang ở ngay trước mắt.",
  "Cứ làm việc bằng cả trái tim, khách hàng sẽ cảm nhận được sự khác biệt.",
  "Người kiên trì theo đuổi mục tiêu dài hạn ít khi thất vọng về sau.",
  "Cứ tin rằng mọi cố gắng hôm nay đều có ý nghĩa cho ngày mai.",
  "Không có con đường tắt nào dẫn đến sự tin tưởng của khách hàng.",
  "Cứ bền bỉ với đam mê của mình, thời gian sẽ trả lời xứng đáng.",
  "Một lời xin lỗi chân thành khi sai sót có thể giữ được một mối quan hệ lâu dài.",
  "Đừng ngừng học hỏi, vì thị trường luôn thay đổi từng ngày.",
  "Cứ giữ chữ tín, đó là tài sản quý giá nhất trong kinh doanh.",
  "Người biết ơn từng đơn hàng nhỏ sẽ đi được đường dài hơn.",
  "Cứ làm việc chăm chỉ và tử tế, thành công sẽ chỉ là vấn đề thời gian.",
  "Một ngày mới là một cơ hội mới để làm tốt hơn ngày hôm qua.",
  "Đừng để nỗi sợ thất bại ngăn mình thử những điều mới.",
  "Cứ chân thành với khách hàng, họ sẽ luôn nhớ đến mình đầu tiên.",
  "Người dám chịu trách nhiệm với sai sót của mình mới xứng đáng được tin tưởng.",
  "Cứ giữ tinh thần lạc quan, khó khăn nào rồi cũng sẽ qua.",
  "Một chút kiên nhẫn hôm nay có thể đổi lấy rất nhiều thành quả về sau.",
  "Đừng ngại việc phải làm lại từ đầu nếu điều đó giúp mọi thứ tốt hơn.",
  "Cứ trân trọng từng khách hàng, dù đơn hàng lớn hay nhỏ.",
  "Người có tâm với công việc luôn để lại ấn tượng tốt về lâu dài.",
  "Cứ cố gắng làm tốt nhất trong khả năng của mình ở thời điểm hiện tại.",
  "Một lời cảm ơn đúng lúc có thể làm ấm lòng cả một ngày dài của ai đó.",
  "Đừng để sự mệt mỏi nhất thời làm lung lay mục tiêu lâu dài.",
  "Cứ giữ sự khiêm tốn dù công việc có thuận lợi đến đâu.",
  "Người chịu khó quan sát và lắng nghe sẽ luôn cải thiện được bản thân.",
  "Cứ làm việc với tâm thế phục vụ, chứ không chỉ để bán được hàng.",
  "Một ngày làm việc có ý nghĩa là một ngày mình giúp được ai đó hài lòng.",
  "Đừng vội đánh giá thấp những cố gắng nhỏ bé của chính mình.",
  "Cứ giữ nhịp độ ổn định, đường dài mới là nơi thể hiện sức bền thật sự.",
  "Người biết trân trọng thời gian sẽ luôn tận dụng nó một cách hiệu quả.",
  "Cứ tin vào bản thân, vì không ai hiểu rõ khả năng của mình hơn chính mình.",
  "Một sản phẩm tốt cộng với sự tận tâm sẽ tạo nên uy tín bền vững.",
  "Đừng để một lần thất bại định nghĩa toàn bộ hành trình của mình.",
  "Cứ giữ lửa nhiệt huyết, vì đó là thứ giúp mình đi được đường dài.",
  "Người làm việc có kế hoạch luôn đỡ vất vả hơn người làm theo cảm hứng.",
  "Cứ bước tiếp dù chậm, miễn là không dừng lại giữa chừng.",
  "Một môi trường làm việc tử tế sẽ nuôi dưỡng những con người tử tế.",
  "Đừng quên nghỉ ngơi đúng lúc để có sức bền cho những cố gắng dài lâu.",
  "Cứ tin rằng sự chăm chỉ hôm nay sẽ không bao giờ là vô ích.",
];

// Hiệu ứng cánh hoa anh đào (sakura) rơi nhẹ nhàng, chỉ để trang trí —
// không chặn thao tác của người dùng (pointerEvents: "none").
function SakuraFall({ theme: THEME }) {
  const [petals, setPetals] = useState([]);

  useEffect(() => {
    const arr = Array.from({ length: 22 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: 9 + Math.random() * 9,
      duration: 9 + Math.random() * 8,
      delay: Math.random() * 10,
      swayDuration: 3 + Math.random() * 3,
      spinDuration: 3.5 + Math.random() * 4,
      opacity: 0.5 + Math.random() * 0.4,
    }));
    setPetals(arr);
  }, []);

  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 1 }}>
      {petals.map((p) => (
        <div
          key={p.id}
          style={{ position: "absolute", top: "-8%", left: `${p.left}%`, animation: `sakuraFall ${p.duration}s linear ${p.delay}s infinite` }}
        >
          <div style={{ animation: `sakuraSway ${p.swayDuration}s ease-in-out infinite` }}>
            <div
              style={{
                width: p.size,
                height: p.size,
                opacity: p.opacity,
                background: `linear-gradient(135deg, #ffdfe6, ${THEME.primary})`,
                borderRadius: "0% 70% 0% 70%",
                boxShadow: "0 0 4px rgba(178,58,72,0.2)",
                animation: `sakuraSpin ${p.spinDuration}s linear infinite`,
              }}
            />
          </div>
        </div>
      ))}
      <style jsx>{`
        @keyframes sakuraFall {
          from {
            transform: translateY(0);
          }
          to {
            transform: translateY(115vh);
          }
        }
        @keyframes sakuraSway {
          0%,
          100% {
            transform: translateX(-14px);
          }
          50% {
            transform: translateX(14px);
          }
        }
        @keyframes sakuraSpin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          div {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function Home() {
  const { theme: THEME } = useTheme();
  const { btnSub } = makeStyles(THEME);
  const [quote, setQuote] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Chọn quote ngẫu nhiên sau khi mount ở client — tránh lệch giữa server/client (hydration).
  useEffect(() => {
    setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: THEME.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 28px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <SakuraFall theme={THEME} />
      <div style={{ fontSize: 40, marginBottom: 18, position: "relative", zIndex: 2 }}>🌸</div>
      <p
        key={quote}
        className="hnCard"
        style={{
          maxWidth: 620,
          minHeight: 78,
          textAlign: "center",
          fontFamily: THEME.headingFont,
          fontStyle: "italic",
          fontSize: 26,
          lineHeight: 1.5,
          color: THEME.text,
          margin: 0,
          position: "relative",
          zIndex: 2,
        }}
      >
        {quote ? `“${quote}”` : ""}
      </p>
      <div style={{ marginTop: 22, fontSize: 14, color: THEME.subtext, letterSpacing: 1, position: "relative", zIndex: 2 }}>HANAICHI</div>

      <div style={{ position: "fixed", left: 18, bottom: 18, zIndex: 50 }}>
        {menuOpen && (
          <div
            className="hnCard"
            style={{
              marginBottom: 10,
              background: THEME.surface,
              border: `1px solid ${THEME.line}`,
              borderRadius: 16,
              boxShadow: THEME.glow,
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              width: 210,
            }}
          >
            {NAV_ITEMS.filter((n) => n.href !== "/").map((n) => (
              <Link key={n.href} href={n.href} style={{ ...btnSub, textDecoration: "none", textAlign: "left" }}>
                {n.icon} {n.label}
              </Link>
            ))}
          </div>
        )}
        <button
          onClick={() => {
            setMenuOpen((v) => !v);
          }}
          title="Chức năng"
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: THEME.brand,
            color: "#fff",
            border: "none",
            fontSize: 20,
            cursor: "pointer",
            boxShadow: THEME.glow,
            display: "grid",
            placeItems: "center",
          }}
        >
          ☰
        </button>
      </div>
    </main>
  );
}
