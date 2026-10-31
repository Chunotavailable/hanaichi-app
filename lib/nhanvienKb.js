// lib/nhanvienKb.js — mẫu câu của shop (từ file viết tắt Unikey), bot dùng để soạn câu trả lời đúng giọng shop.
// Bỏ ra ngoài (cố ý): mẫu theo thời điểm Tết, mẫu né TikTok quét số, mẫu còn chỗ trống "...", và địa chỉ cửa hàng (trùng với trang Tra cứu nhanh).
export const SHOP_KB = [
 {
  "k": "ctb",
  "title": "Lời cảm ơn cuối đơn",
  "kw": "cảm ơn ủng hộ chúc",
  "text": "Cảm ơn quý khách đã lựa chọn và ủng hộ Hanaichi. Anh/chị cần tư vấn thêm gì đừng ngại nhắn tin cho Hanaichi nhé. Chúc Anh/Chị một ngày tốt lành ạ ❤"
 },
 {
  "k": "ch1sz",
  "title": "Tư vấn tăng size khi đi tất dày/chân bè",
  "kw": "size tăng size tất dày chân bè rộng vừa",
  "text": "Nếu mình muốn thoải mái khi đi cả tất dày hay form chân bè ngang thì có thể cân nhắc tăng size, còn không thì có thể chọn đúng size nhé ạ"
 },
 {
  "k": "ch811",
  "title": "Hàng order về sau 2-3 tuần",
  "kw": "order bao lâu về mấy tuần khi nào về thời gian",
  "text": "Hàng order dự kiến về sau 2-3 tuần tính từ ngày đặt hàng hoặc có thể sớm hơn tùy kiện ạ"
 },
 {
  "k": "chbang",
  "title": "Gửi bảng size tham khảo",
  "kw": "bảng size size bảng",
  "text": "dạ e gửi bảng size a/c tham khảo ạ"
 },
 {
  "k": "chbg",
  "title": "Giá chỉ áp dụng khi đặt trên web hanaichi.vn",
  "kw": "giá web hanaichi.vn giá trên ảnh bài đăng",
  "text": "Dạ giá trên ảnh hoặc trên bài đăng bên em chỉ áp dụng khi mình đặt tại web hanaichi.vn a/c nhé"
 },
 {
  "k": "chbh",
  "title": "Chính sách bảo hành",
  "kw": "bảo hành hư hỏng lỗi đổi trả sản phẩm lỗi",
  "text": "Hanaichi chỉ là trung gian mua hộ hàng hoá và đảm bảo giao dịch cũng như vận chuyển về Việt Nam, vì vậy Hanaichi không trực tiếp bảo hành sản phẩm. Tuy nhiên, nếu có hư hỏng do lỗi sản phẩm theo yêu cầu của khách hàng, thì sau 3 tuần kể từ ngày nhận hàng Hanaichi có thể hỗ trợ liên hệ với người bán tại Nhật để tiến hành bảo hành và đổi trả sản phẩm. Phí vận chuyển hai chiều và các chi phí phát sinh trong trường hợp gửi đổi trả hoặc bảo hành sản phẩm sẽ được thông báo lại với khách hàng sau khi Hanaichi có thông tin phản hồi từ người bán tại Nhật ạ."
 },
 {
  "k": "chcm",
  "title": "Size Nhật là số đo cm, quy đổi lại",
  "kw": "size cm quy đổi số đo size nhật",
  "text": "A/c quy đổi lại size giúp e nhé, size của bên Nhật là dạng số đo centimet ạ"
 },
 {
  "k": "chcham",
  "title": "Xin lỗi hàng về chậm",
  "kw": "hàng chậm lâu chưa về chờ lâu",
  "text": "Vì hàng về nhanh chậm tùy kiện, đợt này hàng về cũng chậm hơn chút, a/c thông cảm đợi thêm giúp e nhé ạ"
 },
 {
  "k": "chchao",
  "title": "Chào khách",
  "kw": "chào xin chào",
  "text": "Dạ e chào c"
 },
 {
  "k": "chcheck",
  "title": "Hỏi khách lấy size nào",
  "kw": "lấy size nào chọn size",
  "text": "Mình lấy size nào ạ"
 },
 {
  "k": "chdat",
  "title": "Mời khách nhắn để đặt hàng",
  "kw": "đặt hàng muốn đặt",
  "text": "Anh/Chị đặt hàng ib Hanaichi nhé ạ"
 },
 {
  "k": "chdate",
  "title": "Hạn sử dụng date xa",
  "kw": "date hạn sử dụng hạn dùng",
  "text": "Hàng bên e nhập về liên tục nên a/c yên tâm là date xa ạ"
 },
 {
  "k": "chdich",
  "title": "Hàng nội địa Nhật không có tiếng Việt",
  "kw": "tiếng việt tiếng nhật dịch hướng dẫn sử dụng",
  "text": "dạ hàng nhật nội địa nên sẽ ko có sẵn tiếng việt, tuy nhiên mình có thể dùng chức năng dịch bằng hình ảnh của google cũng rất tiện nha c"
 },
 {
  "k": "chdienthoai",
  "title": "Chỉ tư vấn qua Zalo, không nhận gọi",
  "kw": "gọi điện hotline số điện thoại gọi",
  "text": "Để tránh bỏ sót thông tin đơn hàng, shop chỉ tiếp nhận và tư vấn qua tin nhắn Zalo. Vì mọi trao đổi cần được lưu lại trên hệ thống để dễ kiểm tra và hỗ trợ cho mình sau này ạ. Hotline bên em không mở nhận cuộc gọi, a/c nhắn giúp e qua đây giúp em để được hỗ trợ nhanh và chính xác nhất nha ❤️"
 },
 {
  "k": "chdoinguon",
  "title": "Bộ đổi nguồn điện cho đồ Nhật",
  "kw": "đổi nguồn điện 100v 220v biến áp",
  "text": "dạ bộ đổi nguồn như này a/c có thể ra các hàng điện mua sẽ có giá khác nhau cho từng công suất, được tư vấn và bảo hành kỹ hơn nha c, nếu mình hay dùng đồ nhật thì đầu tư 1 bộ có thể sau dùng được các thiết bị khác nữa ạ"
 },
 {
  "k": "chems",
  "title": "Thời gian nhận hàng sau khi hàng về (EMS)",
  "kw": "ems nhận hàng mấy ngày giao hàng sau khi chuyển khoản",
  "text": "Hàng sẽ nhận được sau khoảng 3-4 ngày không tính ngày chuyển khoản, không tính các ngày kho xếp đồ, cả ngày t7-cn và ngày lễ ạ"
 },
 {
  "k": "chfs1",
  "title": "Hàng có sẵn: chỉ lưu đơn trên fb, không mua trực tiếp",
  "kw": "có sẵn hàng sẵn mua trực tiếp cửa hàng",
  "text": "Dạ với các sản phẩm (giầy dép, quần áo) có sẵn bên e hiện không hỗ trợ qua mua trực tiếp ở Tạ Quang Bửu rồi ạ, e chỉ nhận lưu đơn trong fb này thôi nên a/c cân nhắc kỹ nhé ạ"
 },
 {
  "k": "chfsion",
  "title": "Sản phẩm bán online, qua cửa hàng lấy",
  "kw": "cửa hàng lấy hàng ghé qua xem trực tiếp",
  "text": "Sản phẩm này bên e bán online nên hiện ko có sẵn ở cửa hàng, nếu mình qua lấy thì e sẽ lưu trc cho a/c, bao h kho xếp xong nhắn mình qua lấy sau đc ko ạ"
 },
 {
  "k": "chgd",
  "title": "Xin ảnh giao dịch thành công",
  "kw": "chuyển khoản giao dịch thanh toán ảnh chuyển khoản",
  "text": "c gửi lại giúp e màn hình giao dịch thành công đơn này nhé ạ"
 },
 {
  "k": "chgia",
  "title": "Hỏi khách có ok giá không",
  "kw": "giá ok chốt giá",
  "text": "mình ok đặt với giá này không ạ"
 },
 {
  "k": "chgiay",
  "title": "Phí vận chuyển giày, phí cân 19k/lạng",
  "kw": "ship giày phí vận chuyển phí cân giày",
  "text": "Phí vận chuyển với giày thì sẽ tầm 100-200k tùy đôi, về hàng em cân lên mới báo c chính xác đc ạ, giá cân đang là 19k/lạng nhé ạ"
 },
 {
  "k": "chhet2",
  "title": "Mã hết hàng lúc checkout",
  "kw": "hết hàng checkout không đặt được",
  "text": "dạ e chào a/c ạ mã này  bên đặt hàng báo lúc checkout thì hết hàng ko đặt được rồi ạ, a/c thông cảm giúp bên e mình tham khảo sang mã khác nhé ạ"
 },
 {
  "k": "chib",
  "title": "Hẹn khách check inbox",
  "kw": "inbox ib tin nhắn",
  "text": "dạ mình check ib e nhé"
 },
 {
  "k": "chkiem",
  "title": "Quy định không đồng kiểm, quay clip unbox",
  "kw": "đồng kiểm kiểm tra hàng unbox quay clip nhận hàng",
  "text": "Shop có quy định không đồng kiểm, khách thanh toán nhận hàng, quay clip unbox để shop giải quyết các vấn đề vướng mắc phát sinh nhé ạ"
 },
 {
  "k": "chkho",
  "title": "Báo kho gửi hàng",
  "kw": "kho gửi hàng",
  "text": "Dạ e báo kho gửi hàng ạ"
 },
 {
  "k": "chlay",
  "title": "Khách đặt thì nhắn em",
  "kw": "đặt",
  "text": "Mình đặt nhắn e nhé ạ"
 },
 {
  "k": "chlink",
  "title": "Facebook không xem được ảnh, xin link",
  "kw": "ảnh link không xem được gửi ảnh",
  "text": "Dạ hiện facebook bên e ko xem được ảnh của mình gửi ạ,  a/c cho e xin lại ảnh hoặc link sản phẩm cụ thể mình đang xem để e check giúp mình nhé ạ"
 },
 {
  "k": "chluu",
  "title": "Ok thì nhắn em đặt",
  "kw": "ok đặt",
  "text": "A/c ok đặt nhắn e ạ"
 },
 {
  "k": "chmau",
  "title": "Hỏi màu",
  "kw": "màu lấy màu nào",
  "text": "a/c lấy màu nào ạ"
 },
 {
  "k": "chmh",
  "title": "Ảnh minh họa, xem link để chọn mẫu khác",
  "kw": "ảnh minh họa mẫu",
  "text": "dạ mẫu đó là ảnh minh họa thôi ạ, mình bấm vào link bên e để ở bài viết để tham khảo sp khác nhé"
 },
 {
  "k": "chmo",
  "title": "Xin lại mã đơn hàng bị mờ",
  "kw": "mã đơn mã đơn hàng mờ",
  "text": "mình copy gửi lại giúp e mã đơn hàng nhé ạ, bên e nhìn ảnh mã bị mờ ạ"
 },
 {
  "k": "chnhan",
  "title": "Xin sđt và địa chỉ nhận hàng để lưu đơn",
  "kw": "sđt địa chỉ nhận hàng lưu đơn",
  "text": "mình cho e xin sđt và địa chỉ nhận hàng để bên e lưu đơn cho mình nhé ạ"
 },
 {
  "k": "chreal",
  "title": "Uy tín hơn 11 năm, hàng chuẩn Nhật",
  "kw": "uy tín hàng thật chính hãng tin tưởng 11 năm",
  "text": "Bên em bán hàng hơn 11 năm nay, sản phẩm bên em bán đều đảm bảo chuẩn Nhật, khách hàng mua lâu năm đều rất tin tưởng nên c có thể hoàn toàn yên tâm nhé ạ"
 },
 {
  "k": "chship",
  "title": "Ship trong 1-2 ngày giờ hành chính",
  "kw": "ship giao hàng khi nào",
  "text": "bên e sẽ ship trong vòng 1-2 ngày vào giờ hành chính nhé ạ"
 },
 {
  "k": "chship2",
  "title": "Phí ship nội địa Việt Nam (Hà Nội/tỉnh/giày)",
  "kw": "phí ship ship nội thành ngoại thành tỉnh bao nhiêu phí ship",
  "text": "ship nội địa việt nội thành Hà Nội là 25k, ngoại thành/tỉnh dưới 1kg 30-35k, giày có hộp ship tỉnh là 35k/đôi, phát sinh thêm 1 đôi thì thêm 10k ạ, nếu mình qua cửa hàng e lấy ở Tạ Quang Bửu Hà Nội thì sẽ ko mất ship"
 },
 {
  "k": "chtg",
  "title": "Tỷ giá đặt trên fb là 205",
  "kw": "tỷ giá 205 phí mua hộ tỉ giá fb",
  "text": "hiện a/c đặt tại fb tỉ giá tính là 205 bao gồm phí mua hộ + phí thanh toán + phí bảo hiểm ạ ❤️"
 },
 {
  "k": "chtg2",
  "title": "Vì sao tỷ giá web rẻ hơn fb",
  "kw": "tỷ giá web rẻ hơn fb vì sao",
  "text": "Dạ vì các đơn hàng trên web khách tự thao tác và bên em chạy bằng hệ thống tự động nên có thể giảm thiểu chi phí ở mọi khâu xử lý đơn hàng, vì vậy bên em tính đc tỉ giá rẻ hơn. Còn trên fb các công đoạn đều phải có nhân viên xử lý thủ công nên mất nhiều chi phí hơn ạ."
 },
 {
  "k": "chtk",
  "title": "Gửi link tham khảo",
  "kw": "link tham khảo",
  "text": "dạ e gửi link a/c tham khảo ạ"
 },
 {
  "k": "chtks",
  "title": "Cảm ơn khách",
  "kw": "cảm ơn",
  "text": "dạ e cảm ơn ạ"
 },
 {
  "k": "chtkt",
  "title": "Mời tham khảo sản phẩm khác trên fb",
  "kw": "tham khảo sản phẩm khác",
  "text": "dạ vâng mình tham khảo thêm các sản phầm khác trên trang fb bên e nhé ạ"
 },
 {
  "k": "chtv",
  "title": "Mời nhắn nếu cần tư vấn thêm",
  "kw": "tư vấn thêm",
  "text": "Anh/Chị cần tư vấn thêm gì về sản phẩm nhắn e nha"
 },
 {
  "k": "chthatlac",
  "title": "Kiện thất lạc ở Nhật, huỷ đơn",
  "kw": "thất lạc mất hàng huỷ đơn kiện",
  "text": "dạ e chào c, hiện bên đặt hàng có báo là đơn của mình nằm trong kiện thất lạc ở Nhật nên bên e vẫn đang chờ suốt c ạ, thực sự rất xin lỗi c vì sự cố không mong muốn này ạ. Vì khả năng về được hàng của kiện thất lạc rất thấp nên bên e xin phép hủy đơn này ạ"
 },
 {
  "k": "chthu",
  "title": "Hàng bán online, hỗ trợ đổi size, không thử tại cửa hàng",
  "kw": "thử đồ thử size đổi size không vừa",
  "text": "dạ hiện mặt hàng này bên e bán online thui ạ, có hỗ trợ đổi size nếu ko vừa ạ, chưa có hỗ trợ thử trực tiếp ở cửa hàng rồi ạ"
 },
 {
  "k": "chtrainghiem",
  "title": "Cảm ơn góp ý",
  "kw": "góp ý phản hồi trải nghiệm",
  "text": "dạ e cám ơn a/c đã góp ý ạ. bên e sẽ cố gắng hoàn thiện tất cả mọi thứ để đem đến trải nghiệm tốt nhất cho khách hàng ạ"
 },
 {
  "k": "chtron",
  "title": "Chuyển khoản đúng số tiền không làm tròn",
  "kw": "chuyển khoản làm tròn số tiền hệ thống nhận đơn",
  "text": "mình chuyển khoản đúng số tiền ko làm tròn thì sau hệ thống sẽ tự động nhận đơn cho mình đó ạ"
 },
 {
  "k": "chtrung",
  "title": "Hàng Trung auth full box full tag",
  "kw": "hàng trung auth chính hãng",
  "text": "dạ hàng Trung là bên e ord bên Trung và tag cũng của Trung ạ, bên em vẫn đảm bảo chính hãng Auth 100%, full box full tag, auth chuẩn xịn mịn GIÁ TỐT cho khách hàng ạ"
 },
 {
  "k": "chuuanh",
  "title": "Gửi lại ảnh, không xem được ảnh chuyển tiếp",
  "kw": "ảnh chuyển tiếp gửi lại ảnh",
  "text": "a/c gửi lại giúp e ảnh nhé ạ, bên e ko xem được hình ảnh chuyển tiếp ạ"
 },
 {
  "k": "chuucan",
  "title": "Phí cân 19k/lạng (190k/kg), hàng về cân mới biết",
  "kw": "phí cân cân nặng cân lên bao nhiêu 19k lạng kg",
  "text": "dạ hàng về kho bên e cân lên mới biết chính xác. Phí cân đang là 19k/lạng - 190k/kg ạ"
 },
 {
  "k": "chuudoi",
  "title": "Đổi địa chỉ cố định hay chỉ đơn này",
  "kw": "đổi địa chỉ địa chỉ mới",
  "text": "a/c muốn đổi thông tin địa chỉ mới này cố định cho cả các đơn sau, hay chỉ đổi cho riêng đơn này thôi ạ"
 },
 {
  "k": "chuugiup",
  "title": "Chào hỏi mở đầu",
  "kw": "giúp được gì xin chào",
  "text": "Dạ xin chào anh/chị, Hanaichi có thể giúp gì được cho mình ạ"
 },
 {
  "k": "chuuhet",
  "title": "Sản phẩm hết hàng",
  "kw": "hết hàng",
  "text": "dạ e check thì sản phẩm này hết hàng mất rồi ạ, a/c tham khảo thêm sang các sp khác nhé"
 },
 {
  "k": "chuuib",
  "title": "Check inbox",
  "kw": "inbox",
  "text": "Dạ anh/chị check inbox của Hanaichi nhé ạ"
 },
 {
  "k": "chuulink",
  "title": "Hướng dẫn copy link sản phẩm",
  "kw": "copy link sao chép liên kết gửi link",
  "text": "dạ a/c ấn vào sản phẩm mình muốn đặt. Ở trang sản phẩm mình muốn đặt thì a/c ấn vào dấu ... phía trên góc bên phải màn hình đt > rồi chọn sao chép liên kết > gửi lại e link sp cụ thể nhé ạ"
 },
 {
  "k": "chuuluu",
  "title": "Đã lưu đơn",
  "kw": "lưu đơn",
  "text": "Dạ e lưu đơn rồi ạ, cảm ơn a/c đã ủng hộ Hanaichi ạ"
 },
 {
  "k": "chuuok",
  "title": "Chốt đơn nhanh nhắn lại",
  "kw": "chốt đơn",
  "text": "a/c đặt mã này nhắn lại cho Hanaichi để được chốt đơn nhanh nhất nha, mình cần tư vấn thêm gì về sản phẩm nhắn e nha"
 },
 {
  "k": "chuuok1",
  "title": "Ưng thì nhắn em chốt đơn",
  "kw": "chốt đơn ưng",
  "text": "mình ưng nhắn em để chốt đơn nha, a/c cần tư vấn thêm gì về sản phẩm ko ạ"
 },
 {
  "k": "chuutv",
  "title": "Hỏi chiều cao cân nặng để tư vấn size",
  "kw": "chiều cao cân nặng tư vấn size mặc size nào",
  "text": "Anh/chị cho e chiều cao cân nặng bên e tư vấn cho mình nhé"
 },
 {
  "k": "chuuuong",
  "title": "Uống thuốc/thực phẩm chức năng: hỏi bác sĩ",
  "kw": "uống thuốc thực phẩm chức năng vitamin bác sĩ",
  "text": "dạ để an toàn thì hoặc là c uống riêng từng loại hoặc là mình tham khảo thêm ý kiến bác sĩ giúp e nhé ạ."
 },
 {
  "k": "chuuweb",
  "title": "Cách theo dõi đơn hàng trên web",
  "kw": "theo dõi đơn tình trạng đơn hàng check đơn",
  "text": "Để check tình trạng đơn mình vào phần Theo dõi đơn hàng  ---> chọn Hanaichi Order hoặc Đơn gom để check tình trạng đơn nhé ạ"
 },
 {
  "k": "chxin",
  "title": "Xin sđt và địa chỉ để lên đơn",
  "kw": "sđt địa chỉ lên đơn",
  "text": "Anh/chị cho e xin sđt và địa chỉ để e lên đơn cho mình nha"
 },
 {
  "k": "chxkhet",
  "title": "Sản phẩm đã có khách chốt hết",
  "kw": "khách chốt hết",
  "text": "dạ sp này có khách bên e chốt mất rùi ạ, mình tham khảo thêm các bài trong nhóm nhé, bên e sẽ còn đăng thêm các sp khác ạ"
 },
 {
  "k": "chzl",
  "title": "Đơn về, chọn chuyển khoản hay COD",
  "kw": "đơn đã về thanh toán cod chuyển khoản nốt",
  "text": "dạ e chào anh/chị, mình có đơn hàng order này đã về ạ, mình chọn phương thức chuyển khoản nốt hay ship cod (nhận hàng thanh toán sau) thì báo lại e nhé ạ"
 },
 {
  "k": "gmdc1",
  "title": "Tiếp nhận ý kiến góp ý lên kỹ thuật",
  "kw": "góp ý kỹ thuật lỗi web",
  "text": "dạ vâng bên e sẽ tiếp nhận ý kiến của mình lên kỹ thuật để xem xét điều chỉnh nha a"
 }
];
