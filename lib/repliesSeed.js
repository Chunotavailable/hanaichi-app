// lib/repliesSeed.js
// Dữ liệu ban đầu của trang "Tra cứu nhanh" — chép từ file Google Sheet
// "Viết tắt tổng hợp Hanaichi" của chủ shop. Chỉ dùng để BỔ SUNG mục còn
// thiếu; mục đã sửa/xoá tay trên web không bao giờ bị ghi đè (xem
// pages/api/replies.js).
// private: true -> chỉ chế độ Quản lý nhìn thấy (server lọc bỏ với Khách).

export const REPLY_GROUPS = [
  "Thông tin cửa hàng",
  "Mẫu trả lời khách",
  "Giá & đặt hàng",
  "Size",
  "Đổi trả & thanh toán",
  "Khách sỉ / CTV",
  "Mẫu đăng bài",
  "Nội bộ",
];

export const SEED_REPLIES = [
  // ---------------- Thông tin cửa hàng ----------------
  {
    id: "r-dia-chi",
    group: "Thông tin cửa hàng",
    title: "Địa chỉ & giờ mở cửa",
    content:
      "Cửa hàng tạ quang bửu mở từ T2 đến T7 (8h-12h; 13h30-17h)\nĐịa chỉ: Số nhà 38 ngõ 40 phố Tạ Quang Bửu, Phường Bạch Mai, Hà Nội",
  },
  {
    id: "r-hotline",
    group: "Thông tin cửa hàng",
    title: "Hotline & hỗ trợ khách lẻ",
    content:
      "- Khách lẻ luốn liên hệ gọi đt để biết tt đơn hàng hay cần hỗ trợ bất kì vđề gì về đơn thì báo khách gọi số hotline sau:\n1900292995\nBấm nhánh 1 để gặp nv hotline mảng siêu thị.\nBấm nhánh 2 để gặp nv hotline mảng order\n\n- Vẫn là khách lẻ nhưng muốn gửi trả lại hàng hoặc gửi hàng về shop vì bất kì vđề gì hoặc muốn đặt grab qua lấy đơn, thì gửi địa chỉ cửa hàng + sđt 0906205560\n\n-Khách quan tâm tới việc trở thành Cộng tác viên hoặc muốn mua sỉ thì mới gửi save reply có sẵn trong inbox page, cung cấp số zalo sỉ cho khách.",
  },
  {
    id: "r-kho",
    group: "Thông tin cửa hàng",
    title: "Kho hàng & người phụ trách",
    content:
      "Kho hàng quần áo giày dép sẵn với hàng order ở bên mình khác với kho bán hàng thực phẩm chức năng mĩ phẩm sẵn\nC ly, c Hiền - kho hàng order\nTrang cửa hàng - kho hàng sẵn\nTú - dưới cửa hàng tầng 1",
  },
  {
    id: "r-amazon",
    group: "Thông tin cửa hàng",
    title: "Mã Amazon",
    content: "276-0023",
  },

  // ---------------- Mẫu trả lời khách ----------------
  {
    id: "r-lien-he-zalo",
    group: "Mẫu trả lời khách",
    title: "Đặt hàng / tư vấn qua Zalo",
    content: "Dạ A/c đặt hàng hay cần tư vấn thêm vui lòng liên hệ zá. lồ 0.9.2.8.9.2.4.1.4.2 giúp e nhé ạ",
  },
  {
    id: "r-hang-san",
    group: "Mẫu trả lời khách",
    title: "Hàng có sẵn",
    content: "Hàng bên e có sẵn. Anh/chị nhắn zalo số 0928924142 để được tư vấn và chốt đơn nha !",
  },
  {
    id: "r-hang-order",
    group: "Mẫu trả lời khách",
    title: "Hàng order",
    content: "Hàng order dự kiến về sau 2 tuần. Anh/chị nhắn zalo số 0928924142 để được tư vấn và chốt đơn nha !",
  },
  {
    id: "r-khong-ib-truoc",
    group: "Mẫu trả lời khách",
    title: "Không nhắn trước được cho khách",
    content:
      "Dạ em chào a/c ạ, hiện em đang không ib trước đc cho mình, a/c vui lòng ấn vào đường link dưới đây để gặp trực tiếp tư vấn viên của Hanaichi, các bạn nhân viên sẽ tư vấn cụ thể cũng như lưu đơn cho mình nhé ạ:\nhttps://m.me/HanaichiStore",
  },
  {
    id: "r-cam-on",
    group: "Mẫu trả lời khách",
    title: "Cảm ơn & mời nhắn page",
    content: "Hanaichi cảm ơn anh chị đã quan tâm, vui lòng nhắn tin tại đây m.me/HanaichiStore để được tư vấn và đặt hàng ạ!",
  },
  {
    id: "r-dau-an",
    group: "Mẫu trả lời khách",
    title: "Dầu ăn hạt cải",
    content: "Dầu ăn hạt cải 900k/thùng. 1 thùng 10 chai ( đơn tỉnh ko nhận ship dầu ăn vì là hàng dễ vỡ khi vận chuyển)",
  },

  // ---------------- Giá & đặt hàng ----------------
  {
    id: "r-cong-thuc-gia",
    group: "Giá & đặt hàng",
    title: "Công thức tính giá",
    content:
      "Dạ e gửi công thức tính giá bên e ạ\n>>> Đặt hàng qua inbox FB : giá sp*202 + Phí ship N-V 19K/lạng\n>>> Đặt hàng qua website https://hanaichi.vn: giá sp*200 + Phí ship N-V 19K/lạng",
  },
  {
    id: "r-link-dat-hang",
    group: "Giá & đặt hàng",
    title: "Link hướng dẫn các bước đặt hàng",
    content: "https://hanaichi.vn/helpcenter/topic-item/chi-tiet-cac-buoc-dat-hang-nhanh",
  },
  {
    id: "r-link-fastorder",
    group: "Giá & đặt hàng",
    title: "Link đặt hàng nhanh",
    content: "https://hanaichi.vn/fastorders/fastorder",
  },
  {
    id: "r-link-ty-gia",
    group: "Giá & đặt hàng",
    title: "Link cách tính tỷ giá",
    content: "https://hanaichi.vn/blog/cap-nhat-cach-tinh-ty-gia-moi-cua-hanaichi/",
  },

  // ---------------- Size ----------------
  {
    id: "r-size-can-nang",
    group: "Size",
    title: "Chọn size quần áo theo cân nặng & theo hãng",
    content:
      "Nữ\n45-49kg S\n50-59kg M\n60-69kg L\n70-79kg XL\n\nNam\n50-59kg S\n60-69kg M\n70-79kg L\n80-89kg XL\n\n– Uni, Gu, Adidas, Puma, Reebok size châu á\n– Lacoste, Mango, Zara gửi bảng size cho khách (check trực tiếp trên web hãng, chụp màn hình gửi khách)\n– GAP, HM thì size châu âu (lùi đi 1 size)\n– Nike thì có hai dạng size cả châu âu và châu á, các mã có chữ JP đằng trước hoặc không có chữ đằng trước size -> size châu á, có chữ US -> size châu âu",
  },
  {
    id: "r-size-adidas",
    group: "Size",
    title: "Bảng size Adidas",
    content:
      "Dạ a/c tham khảo giúp em bảng size trong link dưới đây và Chốt theo dạng size ở cột CM giúp em nhé\nhttps://hanaichi.vn/blog/huong-dan-chon-size-adidas/",
  },
  {
    id: "r-size-nike",
    group: "Size",
    title: "Bảng size Nike",
    content:
      "Dạ a/c tham khảo bảng size trong đường link dưới đây và chốt size theo đúng dạng size ở CỘT CM giúp em nhé ạ:\nhttps://hanaichi.vn/blog/bang-size-nike-chinh-hang/",
  },
  {
    id: "r-size-puma",
    group: "Size",
    title: "Bảng size Puma",
    content:
      "Dạ a/c tham khảo bảng size trong đường link dưới đây rồi chốt size theo dạng size ở CỘT CM giúp em nhé ạ:\nhttps://hanaichi.vn/blog/bang-size-giay-puma/",
  },

  // ---------------- Đổi trả & thanh toán ----------------
  {
    id: "r-doi-tra",
    group: "Đổi trả & thanh toán",
    title: "Chính sách đổi size / đổi trả",
    content:
      "Nếu không vừa, Hanaichi hỗ trợ đổi size trong vòng 3 ngày kể từ ngày khách nhận hàng. Nếu không còn size có sẵn để đổi thì khách hàng có thể đổi qua mã sản phẩm khác ạ. Phí ship đổi 2 chiều sẽ do khách hàng chi trả\n\nHàng có sẵn (thời trang) sau khi chốt và xuất kho thì không hoàn hủy được ạ. Hanaichi KHÔNG nhận ship hàng để thử hoặc KHÔNG nhận ship để xem ưng rồi mới thanh toán.\n\nKhi nhận hàng, khách hàng vui lòng kiểm tra kĩ hàng hóa. Nếu có lỗi của sản phẩm, khách hàng vui lòng phản hồi trong vòng 3 ngày kể từ ngày nhận hàng, Hanaichi sẽ đổi hàng mới và không phát sinh bất cứ chi phí nào thêm ạ",
  },
  {
    id: "r-chuyen-khoan",
    group: "Đổi trả & thanh toán",
    title: "Thông tin chuyển khoản",
    content:
      "**Tên chủ tài khoản: LÊ MINH TIẾN\n- Số TK: 9471215555 - Ngân hàng VIETCOMBANK - chi nhánh Nam Hà Nội\nAnh/chị ck xong chụp giúp em ảnh giao dịch thành công nhé",
  },

  // ---------------- Khách sỉ / CTV ----------------
  {
    id: "r-khach-si",
    group: "Khách sỉ / CTV",
    title: "Khách sỉ & cộng tác viên",
    content:
      ">>>> HÀNG ORDER\n- Link facebook chuyên up bài cho khách sỉ: https://www.facebook.com/vietnam.hanaichi\n- Số Zalo chăm sóc riêng cho khách sỉ hàng order: 0903051987\nc cho e xin sđt để bên em add zalo nhóm ctv hàng order ạ\n\n>>> HÀNG CÓ SẴN\n- Số Zalo chăm sóc riêng cho khách sỉ hàng có sẵn: 0932225560 >>> c vui lòng add zalo và cần hỏi gì thì cứ nhắn zalo, sẽ có nhân viên báo giá cụ thể ạ\n\nLƯU Ý: Từ h khách nào muốn làm CTV thì phải hỏi khách đang bán hàng trên kênh nào -> xin link kênh từ khách r check thử xem có đúng khách đó đang bán hàng k -> Rồi mới nhắn khách add số zalo CTV",
  },

  // ---------------- Mẫu đăng bài ----------------
  {
    id: "r-post-xa-kho-ao",
    group: "Mẫu đăng bài",
    title: "Xả kho quần áo",
    content:
      "🔥 SALE GIỜ VÀNG 🔥\nTên SP\nMã:\nDuy nhất 1 chiếc size\nGiá gốc: -> Sale xả kho chỉ còn:\n\nMọi người liên hệ zalo số 0928924142 để chốt đơn nha, bên e sẽ chốt cho ai nhắn sớm nhất ạ !",
  },
  {
    id: "r-post-xa-kho-giay",
    group: "Mẫu đăng bài",
    title: "Xả kho giày",
    content:
      "🔥 SALE GIỜ VÀNG 🔥\nTên SP\nMã:\nDuy nhất 1 đôi size\nGiá gốc: -> Sale xả kho chỉ còn:\n\nMọi người liên hệ zalo số 0928924142 để chốt đơn nha, bên e sẽ chốt cho ai nhắn sớm nhất ạ !",
  },
  {
    id: "r-post-thanh-ly",
    group: "Mẫu đăng bài",
    title: "Thanh lý hộ khách",
    content:
      "[HÀNG ĐĂNG THANH LÍ HỘ KHÁCH]\nTên SP\nMã:\nSize:\nThanh lý giá:\nLiên hệ:\nĐây là sản phẩm khách hàng mua tại Hanaichi. Các bạn vui lòng liên hệ sdt của người thanh lí để trao đổi trực tiếp nhé! Hanaichi cảm ơn <3",
  },

  // ---------------- Nội bộ (chỉ Quản lý) ----------------
  {
    id: "r-zalo-tk",
    group: "Nội bộ",
    title: "Tài khoản Zalo đăng bài",
    content: "0928924142\n\nMật khẩu zalo: matkhau99",
    private: true,
  },
];
