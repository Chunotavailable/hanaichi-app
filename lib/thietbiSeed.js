// lib/thietbiSeed.js
// Dữ liệu mẫu ban đầu cho tab "Thiết bị bếp & vệ sinh", lấy từ file Google Sheet
// chủ shop gửi (chậu rửa, vòi nước, bộ sen... hàng nội địa Nhật). Cách hoạt
// động giống hệt SEED_CLOSET/SEED_GIADUNG: chỉ dùng để TỰ ĐIỀN LẦN ĐẦU hoặc
// bổ sung sản phẩm còn thiếu, không bao giờ ghi đè nội dung đã sửa tay.
export const SEED_THIETBI = [
  {
    id: "tb-chau-rua-1-ho-van-san",
    area: "Bếp",
    name: "Chậu rửa 1 hố vân sần",
    code: "NEFCM-DK FS",
    brand: "Shigeru",
    size: "dài 81 × rộng 52 × sâu 19,7 cm.",
    material: "Inox 304 VÂN SẦN, Trọng lượng: Khoảng 9 kg",
    price: `Báo giá bằng câu dưới đây (thay đổi xưng hô cho phù hợp từng khách hàng):
Dạ Chậu rửa 1 hố vân sần Shigeru
Kích thước dài 81 × rộng 52 × sâu 19,7 cm ạ
Giá về tới VN chỉ 12tr900 thui ạ
Hàng nội địa Nhật chuẩn xịn em mang từ Nhật chuyển về ạ
Hãng xịn sò dùng bền bỉ lâu năm vẫn đẹp xinh và k hề bị tắc bồn, mình dùng cực kỳ yên tâm cho em nhé.
Nhà em cũng có 1 cái nhưng là loại mẫu cũ cùng hãng, em dùng tới 20 năm r mà vẫn đẹp ấy`,
    link: "https://shop.dainichikasei.com/view/item/000000000302",
    highlights: `- Bề mặt vân sần dạng “knit emboss”:  Áp dụng kỹ thuật xử lý bề mặt đặc biệt (hạt sần/chống trầy xước), giúp hạn chế tối đa các vết trầy trong quá trình sử dụng và dễ dàng vệ sinh sạch sẽ
-  Khoang chậu sâu (khoảng 200mm) cùng diện tích hố lớn tạo không gian thoải mái để sơ chế thực phẩm, rửa các loại nồi chảo cỡ lớn mà không lo bắn nước ra ngoài.
- Thoát nước liền khối → ít khe kẽ, dễ vệ sinh, hạn chế đọng nước. Trang bị cổng thoát nước tròn rộng kết hợp xả ngang hiện đại, giúp thoát nước cực nhanh, hạn chế tắc nghẽn rác thải.
- Chất liệu inox 304 nguyên khối bền bỉ, chống ăn mòn, chịu lực tốt, chống bám bẩn và đảm bảo an toàn tuyệt đối cho sức khỏe
- Giảm rung/giảm tiếng ồn
- Có kèm bộ thoát nước chuyên dụng, thiết kế xả ngang thông minh: Giúp tối ưu hóa không gian phía dưới khoang tủ bếp, tăng diện tích chứa đồ. Hệ thống xi-phông chữ Z & Con thỏ rời: Ngăn mùi hôi ngược từ đường ống cống lên gian bếp cực kỳ hiệu quả và dễ dàng tháo lắp vệ sinh định kỳ. Ống nối và các chi tiết chịu nhiệt độ nóng/lạnh tốt, ống xả có gân thép chịu lực bền bỉ theo thời gian`,
    installNotes: "",
  },
  {
    id: "tb-voi-rua-bat-toto-thien-nga-cham",
    area: "Bếp",
    name: "Vòi rửa bát Toto thiên nga chạm",
    code: "TKN34PBTA",
    brand: "TOTO",
    size: "",
    material: "",
    price: "10500k",
    link: "https://item.rakuten.co.jp/jyupro/tkn34pbta/?iasid=07rpp_10095___38-mswt7u0z-1l-bad8cada-f145-42e1-9814-0732129cb33d",
    highlights: `Vòi rửa bát TOTO thiên nga chạm TKN34PBTA mang lại sự tiện nghi cao cấp nhờ thiết kế dáng thiên nga thanh lịch và tính năng tắt mở nước bằng một chạm thông minh ngay trên đầu vòi.
- Kiểu dáng cổ thiên nga: Thân vòi uốn cong mềm mại, tạo điểm nhấn sang trọng và giúp hạn chế đọng nước ở chân vòi.
- Cổ vòi xoay 180 độ, giúp mở rộng tối đa phạm vi làm việc trong bồn rửa.
- Chất liệu đồng thau: Lõi đúc từ đồng thau bền chắc, chịu lực và chịu nhiệt tốt, giúp bảo vệ nguồn nước sạch.
- Bề mặt phủ mạ sáng bóng, chống bám bẩn, chống rỉ sét và dễ lau chùi.
- Nút bấm đóng/mở nước ngay trên đầu vòi: Cho phép bật hoặc tắt dòng nước nhanh chóng bằng một lần nhấn nhẹ ngay ở đầu vòi khi tay đang bận hoặc bám bẩn
- Đầu vòi dây rút: Dây kéo dài linh hoạt giúp đưa nước tới mọi ngóc ngách của bồn rửa hoặc vệ sinh khu vực xung quanh mặt bếp.
- Công nghệ ECO tiết kiệm nước: Hòa trộn bọt khí vào dòng chảy giúp nước phun ra mạnh mẽ nhưng không bị văng bắn tung tóe và tiết kiệm lượng nước tiêu thụ.
- 02 chế độ nước nóng lạnh`,
    installNotes: `- Kích thước lỗ khoét: Lỗ trên chậu rửa hoặc mặt đá phải phù hợp với tiêu chuẩn của vòi nội địa Nhật (thường đường kính lỗ khoảng từ 35mm đến 38mm).
- Không gian dưới bồn rửa: Do TOTO TKN34PBTA có tính năng rút dây (đầu vòi kéo dài tới 65cm), khoang tủ dưới chậu rửa cần được sắp xếp gọn gàng. Đảm bảo đường trượt của dây rút không bị vướng vào ống xả nước, bình nước rửa bát âm bàn hay đồ đạc khác.
- Vòi thiết kế theo tiêu chuẩn Nhật Bản tích hợp công nghệ ECO, yêu cầu áp lực nước cấp ổn định. Nếu áp lực nước quá yếu, dòng chảy có thể không đạt hiệu quả tối đa; nếu áp lực quá mạnh, cần lắp van giảm áp.
- Vị trí chờ nóng/lạnh: Cần bố trí 2 đường nước nóng và lạnh chờ sẵn với van khóa (tấm chặn nước) riêng biệt, khoảng cách thuận lợi để nối dây cấp linh hoạt đi kèm vòi.`,
  },
  {
    id: "tb-voi-rua-bat-toto-thien-nga-khong-cham",
    area: "Bếp",
    name: "Vòi rửa bát Toto thiên nga không chạm",
    code: "TKN34PBRRA",
    brand: "TOTO",
    size: "",
    material: "",
    price: "7500k",
    link: "https://item.rakuten.co.jp/coordiroom/tkn34pbrra-sale/?iasid=07rpp_10095___3w-mt9l55vd-26-2448ff5b-aa01-4e44-aee5-62f3d16799d9",
    highlights: `Vòi rửa bát TOTO TKN34PBRRA sở hữu thiết kế hình cổ ngỗng lấy cảm hứng từ thiên nga cùng nhiều ưu điểm nổi bật về công năng và độ bền
- Thiết kế New Wave cổ ngỗng: Thân vòi uốn cong mềm mại, tạo điểm nhấn sang trọng và giúp hạn chế đọng nước ở chân vòi.
- Đầu vòi dây rút kéo dài: Dây rút linh hoạt vươn dài tới 650 mm, giúp dễ dàng vệ sinh mọi góc của chậu rửa hoặc rửa xoong nồi, thực phẩm cỡ lớn ở bên ngoài.
- 2 kiểu nước, không có nút stop như loại chạm bên trên: Hai chế độ xả nước: Tích hợp chế độ phun bọt mềm (Soft) chống bắn tóe và chế độ vòi sen (Shower) tăng áp, dễ dàng chuyển đổi ngay tại đầu vòi tùy theo nhu cầu sử dụng.
- Cổ vòi xoay linh hoạt: Khả năng xoay đa chiều rộng giúp mở rộng tối đa phạm vi làm việc trong bồn rửa.
- Lắp đặt 1 lỗ (Ø35 ± 2 mm) gọn gàng, phù hợp hầu hết chậu bếp tiêu chuẩn
- Nóng lạnh hai chiều: Điều chỉnh nhiệt độ nước dễ dàng bằng tay gạt, hỗ trợ đắc lực trong mùa lạnh hoặc khi cần rửa sạch dầu mỡ
- Đồng thau nguyên khối: Cấu tạo từ đồng thau bền bỉ, chống oxy hóa và an toàn tuyệt đối cho nguồn nước sinh hoạt gia đình.
- Lớp mạ Nickel Chrome sáng bóng: Bề mặt phủ bóng cao cấp hạn chế bám bẩn, chống rỉ sét và duy trì vẻ đẹp sang trọng theo thời gian.
- Công nghệ ECO tiết kiệm nước: Tối ưu hóa lưu lượng dòng chảy giúp tiết kiệm nước hiệu quả mà không làm giảm áp lực nước khi sử dụng.
- Ống cấp nước: Ống mềm. Chiều dài vòi: 245mm. Bao gồm ống mềm (650mm). Lắp đặt gắn trên mặt bàn. Van một chiều. *Không thể lắp đặt nếu có kệ hoặc vật thể thấp hơn 350mm so với bề mặt lắp đặt vòi. Vui lòng lưu ý.`,
    installNotes: `- Vòi yêu cầu đường kính lỗ chờ trên chậu rửa hoặc mặt đá là Ø35 ± 2 mm (tiêu chuẩn phổ biến). Cần vệ sinh sạch bề mặt quanh lỗ khoét trước khi đặt gioăng.
- Không gian dây rút dưới bồn: Do đầu vòi có dây rút kéo dài tới 650mm, khu vực dưới gầm chậu cần đảm bảo thoáng, không bị vướng bởi dây cấp nước nóng/lạnh, bình nước phụ hay rổ rác, để dây rút chuyển động trơn tru, không bị kẹt hay gập khúc khi kéo ra/thu vào. Có thể lắp thêm quả nặng định vị dây rút theo đúng sơ đồ của hãng.
- Áp lực nước: Vòi hoạt động tốt trong dải áp lực từ 0.05 ~ 0.75 MPa. Nếu áp lực nước quá yếu, dòng chảy phun sen sẽ kém; nếu áp lực quá mạnh vượt mức, cần lắp thêm van giảm áp.
-  Sản phẩm là dòng cơ học hoàn toàn (không dùng điện), khi lắp cần chú ý phân biệt rõ đường cấp nước nóng và nước lạnh để tránh đấu nhầm chiều tay gạt hoặc gây hỏng lõi trộn nhiệt (cartridge). Nên xả sạch đường ống nước trước khi siết dây cấp để loại bỏ mạt sắt, cát sỏi tránh tắc lưới lọc đầu vòi.`,
  },
  {
    id: "tb-voi-co-ngong-lixil-inax",
    area: "Bếp",
    name: "Vòi cổ ngỗng Lixil Inax",
    code: "SF-HM451SYXU",
    brand: "LIXIL INAX",
    size: "",
    material: "",
    price: "5900k",
    link: "https://item.rakuten.co.jp/dandorie/111446010101/?iasid=07rpp_10095___34-msxzh8wd-85-dee307f7-97e9-4179-a814-ea116c5483d0",
    highlights: `Cổ ngỗng
Tia nước nhỏ, tập trung
Đầu vòi kéo dây`,
    installNotes: "",
  },
  {
    id: "tb-voi-co-ngong-lixil-inax-cam-ung",
    area: "Bếp",
    name: "Vòi cổ ngỗng Lixil Inax cảm ứng",
    code: "SF-NA451SU",
    brand: "LIXIL INAX",
    size: "",
    material: "",
    price: "11 triệu",
    link: "https://www.amazon.co.jp/-/en/LIXIL-RSF-672A-Replacement-Installation-Renovation/dp/B0BDR97HK4/ref=sr_1_2?crid=268BB8GMF3FBO&dib=eyJ2IjoiMSJ9.8IKAswuQQAs-4TbNXUu7wYgFlpWmSdxhsIEgyGx2S7vGjHj071QN20LucGBJIEps.EdruhzGxVC1r2MIIfZnBmlXRNoPwSA34Lf-mjQtbp9M&dib_tag=se&keywords=SF-NA451SU&qid=1787718092&sprefix=sf-na451su%2B%2Caps%2C207&sr=8-2&th=1",
    highlights: `Cổ ngỗng
Tia nước nhỏ, tập trung
Đầu vòi kéo dây
Navish – cảm biến không chạm, đưa tay vào sensor để bật/tắt nước`,
    installNotes: "",
  },
  {
    id: "tb-bo-sen-toto-co-ban",
    area: "Phòng tắm",
    name: "Bộ sen Toto dòng cơ bản",
    code: "TBV03401J1",
    brand: "TOTO",
    size: "Cả bao bì, phụ kiện\nnặng tầm 3.1kg",
    material: "",
    price: "4 triệu",
    link: "https://item.rakuten.co.jp/superdeal/15766tototbv03401j12508/",
    highlights: `Có vòi xả dài 170mm
Bát sen Comfort Wave 1 chế độ
Không có nút bấm touch bát sen`,
    installNotes: "",
  },
  {
    id: "tb-bo-sen-toto-touch-1che-do",
    area: "Phòng tắm",
    name: "Bộ sen Toto\nBát sen 1 chế độ, touch trên bát sen",
    code: "TBV03402J1",
    brand: "TOTO",
    size: "Cả bao bì, phụ kiện\nnặng tầm 3.4kg",
    material: "",
    price: "5400k",
    link: "https://item.rakuten.co.jp/coordiroom/tbv03402j1/?iasid=07rpp_10095___3w-mtb92dk3-28-a4a70ea1-9750-4a51-aab1-62b25cb838e7",
    highlights: `Có vòi xả dài 170mm
Có nút touch dừng/bật nước ở bát sen
Bát sen Comfort Wave 1 chế độ`,
    installNotes: "",
  },
  {
    id: "tb-bo-sen-toto-to-3che-do",
    area: "Phòng tắm",
    name: "Bộ sen Toto\nBát sen to 3 chế độ",
    code: "TBV03404J",
    brand: "TOTO",
    size: "Cả bao bì, phụ kiện\nnặng tầm 4kg",
    material: "",
    price: "6000k",
    link: "https://item.rakuten.co.jp/superdeal/15768tototbv03404j2508/?iasid=07rpp_10095___2y-mt9w20rn-15-909fecef-bb8d-48fb-ac94-81dc4e1d846b",
    highlights: `Có vòi xả dài 170mm
Bát sen to Comfort Wave 3 chế độ
Nút ấn trên bát sen là nút chuyển chế độ nước
Không nó nút dừng/bật nước trên bát sen
Bát sen mạ Chrome`,
    installNotes: "",
  },
  {
    id: "tb-bo-sen-toto-cao-cap-to-3che-do",
    area: "Phòng tắm",
    name: "Bộ sen Toto dòng cao cấp\nBát sen to 3 chế độ",
    code: "TMN40STY4Z",
    brand: "TOTO",
    size: "Cả bao bì, phụ kiện\nnặng tầm 5kg",
    material: "",
    price: "10800k",
    link: "https://item.rakuten.co.jp/setubi/tmn40sty4z/",
    highlights: `Có vòi xả dài 70mm
Bát sen to Comfort Wave 3 chế độ
Nút ấn trên bát sen là nút chuyển chế độ nước
Không nó nút dừng/bật nước trên bát sen
Có nút ấn touch ở thân vòi
Bát sen mạ Chrome`,
    installNotes: "",
  },
  {
    id: "tb-bo-sen-toto-cao-cap-1che-do",
    area: "Phòng tắm",
    name: "Bộ sen Toto dòng cao cấp\nBát sen 1 chế độ dòng cơ bản",
    code: "TMN40STY1",
    brand: "TOTO",
    size: "",
    material: "",
    price: "8500k",
    link: "https://item.rakuten.co.jp/k-navy/tmn40sty1/?iasid=07rpp_10095___3i-mt9vhjy8-ba-bb980b64-c626-4b5e-a518-c18b2eaff1d2",
    highlights: `Có vòi xả dài 70mm
Đầu sen bằng nhựa, Comfort Wave 1 chế độ
Không nó nút dừng/bật nước trên bát sen
Có nút ấn touch ở thân vòi`,
    installNotes: "",
  },
  {
    id: "tb-bat-sen-sanei-bong-khi",
    area: "Phòng tắm",
    name: "Bát sen Sanei dòng bóng khí",
    code: "PS3136-81XA-CDP",
    brand: "SANEI",
    size: "",
    material: "",
    price: "1990k",
    link: "https://www.amazon.co.jp/-/en/PS3136-81XA-CDP-Bubble-Shower-Metallic-Saving/dp/B0BM37HY2N?ref_=dp_pba_bcd_vb&th=1",
    highlights: `Ultra Fine Bubble: có bộ tạo bọt khí siêu mịn tích hợp sẵn
Tia nước cực nhỏ 0,3 mm
Có nút STOP ngay trên bát sen
Tiết kiệm nước khoảng 50%
Mặt phun inox tháo ra được
Made in Japan`,
    installNotes: "",
  },
  {
    id: "tb-bo-sen-cay-toto",
    area: "Phòng tắm",
    name: "Bộ sen cây TOTO",
    code: "TBW04401J1-04J",
    brand: "TOTO",
    size: "",
    material: "",
    price: "14500k",
    link: "https://item.rakuten.co.jp/jyupro/tbw04401j1/",
    highlights: `Có sen trần/overhead shower
Có tay sen Comfort Wave 1 Mode
Có vòi xả dài 170mm`,
    installNotes: "",
  },
  {
    id: "tb-voi-rua-mat-toto",
    area: "Bồn rửa mặt",
    name: "Vòi rửa mặt",
    code: "TLG04302JA",
    brand: "TOTO",
    size: "",
    material: "",
    price: "",
    link: "https://item.rakuten.co.jp/liviterasu/tls04302ja/?iasid=07rpp_10095___3j-mt9zrok4-14-a33e502c-02ac-4eb5-9a83-bbe377092aea",
    highlights: "",
    installNotes: "",
  },
];

// Các câu hỏi khách hay hỏi + mẫu câu trả lời sẵn, để tra nhanh khi tư vấn
// (nguyên văn từ file chủ shop gửi, không chỉnh sửa nội dung).
export const SEED_THIETBI_FAQ = [
  {
    id: "faq-ho-tro-lap-dat",
    title: "Khách hỏi: Có hỗ trợ lắp đặt không?",
    content:
      "Dạ sản phẩm này rất dễ lắp đặt, bất kì thợ nước nào cũng có thể lắp đặt tại VN bình thường ạ. Nếu a/c cần hỗ trợ em giới thiệu cho mình thợ nước nhà em đến hỗ trợ nha.",
  },
  {
    id: "faq-bao-hanh-chau-rua",
    title: "Khách hỏi: Có bảo hành không? (chậu rửa)",
    content: `Dạ chậu rửa này là hàng made in Japan nội địa Nhật chuẩn xịn 100% ạ. Hàng hãng chuẩn chỉnh dày dặn cực kì, sản phẩm k dùng điện mà cơ hoàn toàn nên k sợ hỏng đâu ạ. Bộ xi phông và tất cả các phụ kiện đi kèm cũng như chậu rửa đều chính hãng. Mà hàng hãng thì siêu siêu bền ạ. Nhà em dùng 1 chậu rửa của hãng này, mẫu cũ đời từ lâu rùi, còn k xịn bằng mẫu này mà 20 năm r vẫn mới nguyên, chưa biết tắc hỏng là gì luôn ấy ạ
Nên mình dùng cứ yên tâm nhé k hỏng đc đâu ạ`,
  },
  {
    id: "faq-bao-hanh-voi-sen",
    title: "Khách hỏi: Có bảo hành không? (vòi, bộ bát sen)",
    content:
      "Dạ đây là sản phẩm cơ hoàn toàn, k dùng điện hay pin nên k sợ hỏng đâu ạ. Bên em bán cũng nhiều r, bản thân em cũng đang dùng, hàng hãng chuẩn xịn đét dày dặn, chất liệu siêu siêu bền bỉ k cần phải bàn, nên nói thực là dùng k biết bao giờ mới hỏng được ạ. Mình cứ yên tâm nhé",
  },
  {
    id: "faq-meo-tu-van",
    title: "💡 Mẹo tư vấn thêm",
    content:
      "Lúc tư vấn tận dụng triệt để mấy ý kiểu này: \"nhà em cũng đang dùng, thích vô cùng luôn ấy ạ, nói thực là dùng hàng nội địa Nhật nó khác biệt lắm ạ\" hoặc \"hàng hãng chuẩn xịn mình cứ yên tâm nhé, nội địa Nhật 100% em mang về VN cho mình ạ\"",
  },
];
